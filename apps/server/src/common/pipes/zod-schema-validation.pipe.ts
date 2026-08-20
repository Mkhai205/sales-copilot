import { BadRequestException, Body, Injectable, Param, PipeTransform, Query } from '@nestjs/common';

type ZodSchemaLike = {
  safeParse: (value: unknown) =>
    | { success: true; data: unknown }
    | {
        success: false;
        error: { issues: Array<{ path: Array<string | number>; message: string }> };
      };
};

@Injectable()
export class ZodSchemaValidationPipe<TSchema extends ZodSchemaLike> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.') || 'payload',
      message: issue.message,
    }));

    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      errors,
    });
  }
}

export const ZodBody = <T extends ZodSchemaLike>(schema: T) =>
  Body(new ZodSchemaValidationPipe(schema));

export const ZodQuery = <T extends ZodSchemaLike>(schema: T) =>
  Query(new ZodSchemaValidationPipe(schema));

export const ZodParam = <T extends ZodSchemaLike>(schema: T) =>
  Param(new ZodSchemaValidationPipe(schema));
