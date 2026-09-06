import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';
import { StructuredOutputService } from '../structured-output.service';

describe('StructuredOutputService (Type-Safe JSON & Auto-Repair)', () => {
  let service: StructuredOutputService;

  const testSchema = z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  });

  beforeEach(() => {
    service = new StructuredOutputService();
  });

  it('should strip markdown code fences cleanly', () => {
    const fenced = '```json\n{"intent": "PRICING", "confidence": 0.9, "urgency": "HIGH"}\n```';
    assert.strictEqual(
      service.stripCodeFences(fenced),
      '{"intent": "PRICING", "confidence": 0.9, "urgency": "HIGH"}',
    );
  });

  it('should parse valid JSON directly adhering to schema', async () => {
    const raw = '{"intent": "PRICING", "confidence": 0.85, "urgency": "HIGH"}';
    const result = await service.parseAndValidate({
      schema: testSchema,
      rawOutput: raw,
    });

    assert.strictEqual(result.intent, 'PRICING');
    assert.strictEqual(result.confidence, 0.85);
    assert.strictEqual(result.urgency, 'HIGH');
  });

  it('should parse JSON embedded inside text preamble/postamble', async () => {
    const raw =
      'Sure! Here is the extracted analysis:\n{"intent": "DEMO_REQUEST", "confidence": 0.95, "urgency": "HIGH"}\nHope this helps!';
    const result = await service.parseAndValidate({
      schema: testSchema,
      rawOutput: raw,
    });

    assert.strictEqual(result.intent, 'DEMO_REQUEST');
    assert.strictEqual(result.confidence, 0.95);
  });

  it('should trigger 1-shot repair when first attempt is malformed', async () => {
    const malformed = '{"intent": "PRICING", confidence: 0.85'; // Invalid JSON syntax
    let repairCalled = false;

    const repairExecutor = async (prompt: string): Promise<string> => {
      repairCalled = true;
      assert.ok(prompt.includes('failed schema validation'));
      return '{"intent": "PRICING", "confidence": 0.85, "urgency": "LOW"}';
    };

    const result = await service.parseAndValidate({
      schema: testSchema,
      rawOutput: malformed,
      repairExecutor,
    });

    assert.strictEqual(repairCalled, true);
    assert.strictEqual(result.intent, 'PRICING');
    assert.strictEqual(result.urgency, 'LOW');
  });

  it('should throw UnprocessableEntityException when both attempts fail validation', async () => {
    const malformed1 = 'not json at all';
    const malformed2 = '{"intent": 123, "confidence": "high"}'; // Wrong types

    await assert.rejects(
      async () => {
        await service.parseAndValidate({
          schema: testSchema,
          rawOutput: malformed1,
          repairExecutor: async () => malformed2,
        });
      },
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityException);
        const response = err.getResponse() as any;
        assert.strictEqual(response.code, 'LLM_SCHEMA_VALIDATION_FAILED');
        return true;
      },
    );
  });

  it('should throw immediately if no repairExecutor is provided on validation failure', async () => {
    const invalid = '{"intent": "DEMO", "confidence": 5.0}'; // Confidence > 1

    await assert.rejects(
      async () => {
        await service.parseAndValidate({
          schema: testSchema,
          rawOutput: invalid,
        });
      },
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityException);
        const res = err.getResponse() as any;
        assert.strictEqual(res.code, 'LLM_SCHEMA_VALIDATION_FAILED');
        return true;
      },
    );
  });
});
