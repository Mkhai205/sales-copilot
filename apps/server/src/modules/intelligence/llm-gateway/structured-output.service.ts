import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';

export interface ParseAndValidateOptions<T> {
  schema: z.ZodType<T>;
  rawOutput: string;
  repairExecutor?: (repairPrompt: string) => Promise<string>;
}

@Injectable()
export class StructuredOutputService {
  private readonly logger = new Logger(StructuredOutputService.name);

  /**
   * Cleans common LLM formatting artifacts like ```json ... ``` code blocks.
   */
  stripCodeFences(text: string): string {
    const trimmed = text.trim();
    const jsonMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }
    return trimmed;
  }

  /**
   * Attempts to parse JSON safely from string.
   */
  parseJson(text: string): { success: boolean; data?: any; error?: string } {
    const cleaned = this.stripCodeFences(text);
    try {
      const parsed = JSON.parse(cleaned);
      return { success: true, data: parsed };
    } catch (err: any) {
      // Try to find first '{' and last '}' if model included preamble
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          const sub = cleaned.substring(firstBrace, lastBrace + 1);
          const parsed = JSON.parse(sub);
          return { success: true, data: parsed };
        } catch {
          // Fall through to error
        }
      }

      // Try to find first '[' and last ']' for array responses
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        try {
          const sub = cleaned.substring(firstBracket, lastBracket + 1);
          const parsed = JSON.parse(sub);
          return { success: true, data: parsed };
        } catch {
          // Fall through to error
        }
      }

      return { success: false, error: err.message };
    }
  }

  /**
   * Parses and validates raw LLM output against a Zod schema.
   * If initial validation fails and a repairExecutor is provided, issues a 1-shot repair prompt.
   * Throws UnprocessableEntityException if validation ultimately fails.
   */
  async parseAndValidate<T>(options: ParseAndValidateOptions<T>): Promise<T> {
    const { schema, rawOutput, repairExecutor } = options;

    // Attempt 1
    const attempt1 = this.tryValidate(schema, rawOutput);
    if (attempt1.success) {
      return attempt1.data!;
    }

    this.logger.warn(`Structured output validation attempt 1 failed: ${attempt1.error}`);

    // If no repair executor, throw immediately
    if (!repairExecutor) {
      throw new UnprocessableEntityException({
        code: 'LLM_SCHEMA_VALIDATION_FAILED',
        message: 'LLM output does not adhere to the required schema',
        details: attempt1.error,
        rawOutput,
      });
    }

    // Attempt 2: 1-shot repair
    const repairPrompt = `The previous response failed schema validation with the following error:\n${attempt1.error}\n\nPrevious raw output:\n${rawOutput}\n\nPlease output ONLY a single valid JSON object that strictly adheres to the schema. Do not include explanation, preamble, or markdown outside of the JSON block.`;

    try {
      const repairedRaw = await repairExecutor(repairPrompt);
      const attempt2 = this.tryValidate(schema, repairedRaw);
      if (attempt2.success) {
        this.logger.log('Structured output 1-shot repair succeeded');
        return attempt2.data!;
      }

      this.logger.error(`Structured output repair attempt 2 also failed: ${attempt2.error}`);
      throw new UnprocessableEntityException({
        code: 'LLM_SCHEMA_VALIDATION_FAILED',
        message: 'LLM output does not adhere to the required schema after 1-shot repair',
        details: attempt2.error,
        repairedRaw,
      });
    } catch (err: any) {
      if (err instanceof UnprocessableEntityException) {
        throw err;
      }
      this.logger.error(`Error during structured output repair: ${err.message}`, err);
      throw new UnprocessableEntityException({
        code: 'LLM_SCHEMA_VALIDATION_FAILED',
        message: 'Failed to execute 1-shot repair prompt',
        details: err.message,
      });
    }
  }

  private tryValidate<T>(
    schema: z.ZodType<T>,
    raw: string,
  ): { success: boolean; data?: T; error?: string } {
    const jsonResult = this.parseJson(raw);
    if (!jsonResult.success) {
      return { success: false, error: `JSON Parse Error: ${jsonResult.error}` };
    }

    const zodResult = schema.safeParse(jsonResult.data);
    if (!zodResult.success) {
      const formattedErrors = zodResult.error.issues
        .map(i => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; ');
      return { success: false, error: `Schema Validation Error: ${formattedErrors}` };
    }

    return { success: true, data: zodResult.data };
  }
}
