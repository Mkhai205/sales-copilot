import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import { ZodSchemaValidationPipe } from '../zod-schema-validation.pipe';

describe('ZodSchemaValidationPipe (Common Pipe — FINDING-P9-02)', () => {
  const userSchema = z.object({
    email: z.string().email('Invalid email address'),
    age: z.number().min(18, 'Must be at least 18 years old'),
    profile: z.object({
      bio: z.string().min(5, 'Bio must be at least 5 characters'),
    }),
  });

  const pipe = new ZodSchemaValidationPipe(userSchema);

  it('should transform and return parsed data when payload satisfies schema', () => {
    const validPayload = {
      email: 'john@example.com',
      age: 25,
      profile: { bio: 'Software Engineer' },
    };

    const result = pipe.transform(validPayload);
    assert.deepStrictEqual(result, validPayload);
  });

  it('should throw BadRequestException with VALIDATION_FAILED when payload is invalid', () => {
    const invalidPayload = {
      email: 'not-an-email',
      age: 16,
      profile: { bio: 'hi' },
    };

    assert.throws(
      () => pipe.transform(invalidPayload),
      (err: any) => {
        assert.strictEqual(err instanceof BadRequestException, true);
        const response = err.getResponse();
        assert.strictEqual(response.code, 'VALIDATION_FAILED');
        assert.strictEqual(response.message, 'Validation failed');
        assert.strictEqual(response.errors.length, 3);

        const emailErr = response.errors.find((e: any) => e.field === 'email');
        assert.ok(emailErr);
        assert.strictEqual(emailErr.message, 'Invalid email address');

        const ageErr = response.errors.find((e: any) => e.field === 'age');
        assert.ok(ageErr);
        assert.strictEqual(ageErr.message, 'Must be at least 18 years old');

        const bioErr = response.errors.find((e: any) => e.field === 'profile.bio');
        assert.ok(bioErr);
        assert.strictEqual(bioErr.message, 'Bio must be at least 5 characters');

        return true;
      },
    );
  });

  it('should format field as "payload" when issue path is empty (root level failure)', () => {
    const stringOnlySchema = z.string({ message: 'Root payload must be a string' });
    const stringPipe = new ZodSchemaValidationPipe(stringOnlySchema);

    assert.throws(
      () => stringPipe.transform(12345),
      (err: any) => {
        assert.strictEqual(err instanceof BadRequestException, true);
        const response = err.getResponse();
        assert.strictEqual(response.code, 'VALIDATION_FAILED');
        assert.strictEqual(response.errors[0].field, 'payload');
        return true;
      },
    );
  });
});
