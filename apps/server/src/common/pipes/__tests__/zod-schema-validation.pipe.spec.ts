import { expectThrow } from '../../../../test/test-assertions';
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
    expect(result).toEqual(validPayload);
  });

  it('should throw BadRequestException with VALIDATION_FAILED when payload is invalid', () => {
    const invalidPayload = {
      email: 'not-an-email',
      age: 16,
      profile: { bio: 'hi' },
    };

    expectThrow(
      () => pipe.transform(invalidPayload),
      (err: any) => {
        expect(err instanceof BadRequestException).toBe(true);
        const response = err.getResponse();
        expect(response.code).toBe('VALIDATION_FAILED');
        expect(response.message).toBe('Validation failed');
        expect(response.errors.length).toBe(3);

        const emailErr = response.errors.find((e: any) => e.field === 'email');
        expect(emailErr).toBeTruthy();
        expect(emailErr.message).toBe('Invalid email address');

        const ageErr = response.errors.find((e: any) => e.field === 'age');
        expect(ageErr).toBeTruthy();
        expect(ageErr.message).toBe('Must be at least 18 years old');

        const bioErr = response.errors.find((e: any) => e.field === 'profile.bio');
        expect(bioErr).toBeTruthy();
        expect(bioErr.message).toBe('Bio must be at least 5 characters');

        return true;
      },
    );
  });

  it('should format field as "payload" when issue path is empty (root level failure)', () => {
    const stringOnlySchema = z.string({ message: 'Root payload must be a string' });
    const stringPipe = new ZodSchemaValidationPipe(stringOnlySchema);

    expectThrow(
      () => stringPipe.transform(12345),
      (err: any) => {
        expect(err instanceof BadRequestException).toBe(true);
        const response = err.getResponse();
        expect(response.code).toBe('VALIDATION_FAILED');
        expect(response.errors[0].field).toBe('payload');
        return true;
      },
    );
  });
});
