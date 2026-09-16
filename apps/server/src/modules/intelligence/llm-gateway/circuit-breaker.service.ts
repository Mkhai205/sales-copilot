import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerState, LlmProvider } from '@sales-copilot/shared-contracts';

interface CircuitState {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  lastFailureTime: number;
  openedAt: number;
  halfOpenProbeInFlight: boolean;
  rollingRequests: Array<{ timestamp: number; success: boolean }>;
}

export interface CircuitBreakerConfig {
  rollingWindowMs?: number;
  minRequestsInWindow?: number;
  failureRateThreshold?: number; // e.g. 0.3 = 30%
  consecutiveFailuresThreshold?: number; // e.g. 3
  openCooldownMs?: number; // e.g. 30,000ms
  halfOpenReopenCooldownMs?: number; // e.g. 60,000ms
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  backoffFactor?: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  private readonly config: Required<CircuitBreakerConfig>;
  private readonly providerStates = new Map<LlmProvider, CircuitState>();

  constructor() {
    this.config = {
      rollingWindowMs: 60_000,
      minRequestsInWindow: 5,
      failureRateThreshold: 0.3,
      consecutiveFailuresThreshold: 3,
      openCooldownMs: 30_000,
      halfOpenReopenCooldownMs: 60_000,
      initialRetryDelayMs: 400,
      maxRetryDelayMs: 5000,
      backoffFactor: 2,
    };

    // Initialize states
    for (const provider of Object.values(LlmProvider)) {
      this.providerStates.set(provider, {
        state: CircuitBreakerState.CLOSED,
        consecutiveFailures: 0,
        lastFailureTime: 0,
        openedAt: 0,
        halfOpenProbeInFlight: false,
        rollingRequests: [],
      });
    }
  }

  getState(provider: LlmProvider): CircuitBreakerState {
    const circuit = this.getOrCreateCircuit(provider);
    const now = Date.now();

    if (circuit.state === CircuitBreakerState.OPEN) {
      if (now - circuit.openedAt >= this.config.openCooldownMs) {
        circuit.state = CircuitBreakerState.HALF_OPEN;
        circuit.halfOpenProbeInFlight = false;
        this.logger.log(
          `Circuit Breaker for ${provider} transitioning from OPEN to HALF_OPEN (probe canary ready)`,
        );
      }
    }

    return circuit.state;
  }

  canExecute(provider: LlmProvider): boolean {
    const state = this.getState(provider);
    if (state === CircuitBreakerState.CLOSED) {
      return true;
    }
    if (state === CircuitBreakerState.HALF_OPEN) {
      const circuit = this.getOrCreateCircuit(provider);
      if (!circuit.halfOpenProbeInFlight) {
        circuit.halfOpenProbeInFlight = true;
        return true;
      }
      return false;
    }
    return false;
  }

  recordSuccess(provider: LlmProvider): void {
    const circuit = this.getOrCreateCircuit(provider);
    const now = Date.now();

    this.cleanRollingWindow(circuit, now);
    circuit.rollingRequests.push({ timestamp: now, success: true });
    circuit.consecutiveFailures = 0;

    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      circuit.state = CircuitBreakerState.CLOSED;
      circuit.halfOpenProbeInFlight = false;
      this.logger.log(`Canary probe succeeded. Circuit Breaker for ${provider} is now CLOSED`);
    }
  }

  recordFailure(provider: LlmProvider, error: any): void {
    const circuit = this.getOrCreateCircuit(provider);
    const now = Date.now();

    this.cleanRollingWindow(circuit, now);
    circuit.rollingRequests.push({ timestamp: now, success: false });
    circuit.consecutiveFailures += 1;
    circuit.lastFailureTime = now;

    const errorStatus = error?.status || error?.statusCode || error?.response?.status;
    const isRateLimit = errorStatus === 429 || error?.code === 'RESOURCE_EXHAUSTED';
    const isServerError = errorStatus >= 500 && errorStatus < 600;
    const isTimeout =
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ECONNABORTED' ||
      error?.message?.includes('timeout');

    // If HALF_OPEN fails, immediately reopen with longer cooldown
    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      circuit.state = CircuitBreakerState.OPEN;
      circuit.openedAt = now + (this.config.halfOpenReopenCooldownMs - this.config.openCooldownMs);
      circuit.halfOpenProbeInFlight = false;
      this.logger.warn(
        `Canary probe failed for ${provider}. Reopening circuit for ${this.config.halfOpenReopenCooldownMs}ms. Error: ${error?.message}`,
      );
      return;
    }

    // Check consecutive failure threshold or immediate 429 / 5xx / timeout trip
    if (
      circuit.consecutiveFailures >= this.config.consecutiveFailuresThreshold ||
      isRateLimit ||
      isServerError ||
      isTimeout
    ) {
      this.trip(
        provider,
        isRateLimit
          ? '429 Rate limit exceeded'
          : isServerError
            ? 'Upstream 5xx server error'
            : isTimeout
              ? 'Request timeout'
              : `${circuit.consecutiveFailures} consecutive failures`,
      );
      return;
    }

    // Check failure rate in rolling window
    if (circuit.rollingRequests.length >= this.config.minRequestsInWindow) {
      const failures = circuit.rollingRequests.filter(r => !r.success).length;
      const rate = failures / circuit.rollingRequests.length;
      if (rate >= this.config.failureRateThreshold) {
        this.trip(
          provider,
          `Failure rate ${(rate * 100).toFixed(1)}% exceeded threshold ${this.config.failureRateThreshold * 100}%`,
        );
      }
    }
  }

  trip(provider: LlmProvider, reason: string): void {
    const circuit = this.getOrCreateCircuit(provider);
    circuit.state = CircuitBreakerState.OPEN;
    circuit.openedAt = Date.now();
    circuit.halfOpenProbeInFlight = false;
    this.logger.warn(
      `⚠️ Circuit Breaker TRIPPED to OPEN for ${provider}. Reason: ${reason}. Cooldown: ${this.config.openCooldownMs}ms`,
    );
  }

  reset(provider: LlmProvider): void {
    const circuit = this.getOrCreateCircuit(provider);
    circuit.state = CircuitBreakerState.CLOSED;
    circuit.consecutiveFailures = 0;
    circuit.openedAt = 0;
    circuit.halfOpenProbeInFlight = false;
    circuit.rollingRequests = [];
    this.logger.log(`Circuit Breaker for ${provider} was manually reset to CLOSED`);
  }

  calculateBackoffDelay(attempt: number): number {
    const { initialRetryDelayMs, backoffFactor, maxRetryDelayMs } = this.config;
    const exponential = initialRetryDelayMs * Math.pow(backoffFactor, attempt);
    const fullJitter = Math.random() * exponential;
    return Math.min(maxRetryDelayMs, Math.floor(fullJitter));
  }

  private cleanRollingWindow(circuit: CircuitState, now: number): void {
    const cutoff = now - this.config.rollingWindowMs;
    circuit.rollingRequests = circuit.rollingRequests.filter(r => r.timestamp > cutoff);
  }

  private getOrCreateCircuit(provider: LlmProvider): CircuitState {
    let circuit = this.providerStates.get(provider);
    if (!circuit) {
      circuit = {
        state: CircuitBreakerState.CLOSED,
        consecutiveFailures: 0,
        lastFailureTime: 0,
        openedAt: 0,
        halfOpenProbeInFlight: false,
        rollingRequests: [],
      };
      this.providerStates.set(provider, circuit);
    }
    return circuit;
  }
}
