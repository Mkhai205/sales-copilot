import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { CircuitBreakerState, LlmProvider } from '@sales-copilot/shared-contracts';
import { CircuitBreakerService } from '../circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  it('should initialize all providers in CLOSED state', () => {
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.CLOSED);
    assert.strictEqual(service.getState(LlmProvider.OPENAI), CircuitBreakerState.CLOSED);
    assert.strictEqual(service.canExecute(LlmProvider.GEMINI), true);
    assert.strictEqual(service.canExecute(LlmProvider.OPENAI), true);
  });

  it('should remain CLOSED when success is recorded', () => {
    service.recordSuccess(LlmProvider.GEMINI);
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.CLOSED);
  });

  it('should trip to OPEN immediately upon HTTP 429 Rate Limit', () => {
    const error429 = { status: 429, message: 'Resource exhausted' };
    service.recordFailure(LlmProvider.GEMINI, error429);

    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.OPEN);
    assert.strictEqual(service.canExecute(LlmProvider.GEMINI), false);
  });

  it('should trip to OPEN after 3 consecutive failures', () => {
    const err = new Error('500 Internal Server Error');
    service.recordFailure(LlmProvider.GEMINI, err);
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.CLOSED);

    service.recordFailure(LlmProvider.GEMINI, err);
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.CLOSED);

    service.recordFailure(LlmProvider.GEMINI, err);
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.OPEN);
    assert.strictEqual(service.canExecute(LlmProvider.GEMINI), false);
  });

  it('should trip to OPEN when rolling failure rate exceeds 30%', () => {
    // 5 requests total: 2 success, 3 failures (60% failure rate)
    service.recordSuccess(LlmProvider.GEMINI);
    service.recordSuccess(LlmProvider.GEMINI);
    service.recordFailure(LlmProvider.GEMINI, new Error('network hiccup'));
    service.recordFailure(LlmProvider.GEMINI, new Error('timeout'));
    service.recordFailure(LlmProvider.GEMINI, new Error('service error'));

    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.OPEN);
  });

  it('should transition to HALF_OPEN after cooldown expires', () => {
    service.trip(LlmProvider.GEMINI, 'Simulated trip');
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.OPEN);

    // Fast-forward circuit internal openedAt
    const circuit = (service as any).getOrCreateCircuit(LlmProvider.GEMINI);
    circuit.openedAt = Date.now() - 35_000; // 35 seconds ago (> 30s cooldown)

    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.HALF_OPEN);
    assert.strictEqual(service.canExecute(LlmProvider.GEMINI), true);
    // Second check while probe is in flight should return false
    assert.strictEqual(service.canExecute(LlmProvider.GEMINI), false);
  });

  it('should close circuit if canary probe in HALF_OPEN succeeds', () => {
    service.trip(LlmProvider.GEMINI, 'Simulated trip');
    const circuit = (service as any).getOrCreateCircuit(LlmProvider.GEMINI);
    circuit.openedAt = Date.now() - 35_000;

    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.HALF_OPEN);
    service.recordSuccess(LlmProvider.GEMINI);
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.CLOSED);
  });

  it('should reopen circuit for extended cooldown if canary probe in HALF_OPEN fails', () => {
    service.trip(LlmProvider.GEMINI, 'Simulated trip');
    const circuit = (service as any).getOrCreateCircuit(LlmProvider.GEMINI);
    circuit.openedAt = Date.now() - 35_000;

    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.HALF_OPEN);
    service.recordFailure(LlmProvider.GEMINI, new Error('Canary failed'));
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.OPEN);
  });

  it('should calculate exponential backoff delay with jitter within bounds', () => {
    const delay0 = service.calculateBackoffDelay(0);
    const delay3 = service.calculateBackoffDelay(3);

    assert.ok(delay0 >= 0 && delay0 <= 400);
    assert.ok(delay3 >= 0 && delay3 <= 5000);
  });

  it('should support manual reset', () => {
    service.trip(LlmProvider.GEMINI, 'Manual test');
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.OPEN);

    service.reset(LlmProvider.GEMINI);
    assert.strictEqual(service.getState(LlmProvider.GEMINI), CircuitBreakerState.CLOSED);
    assert.strictEqual(service.canExecute(LlmProvider.GEMINI), true);
  });
});
