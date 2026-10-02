import type { LanguageModel } from 'ai';

/**
 * Minimal non-streaming LanguageModelV3 stub for e2e tests. The agent loop only
 * calls `doGenerate` (generateText), so a plain scripted object is enough — the
 * ESM-only `ai/test` mocks cannot be required from this CJS jest setup.
 *
 * The step shapes follow the provider spec v3 exactly: finishReason is the
 * {unified, raw} object and usage is the nested per-bucket structure. A flat
 * legacy shape is silently ignored by the SDK (the tool loop never continues),
 * which is why these helpers exist instead of inline literals.
 */
export interface ScriptedModelStep {
  content: Array<Record<string, unknown>>;
  finishReason: {
    unified: 'stop' | 'tool-calls' | 'length' | 'content-filter' | 'error' | 'other';
    raw: string | undefined;
  };
  usage: {
    inputTokens: {
      total: number | undefined;
      noCache: number | undefined;
      cacheRead: number | undefined;
      cacheWrite: number | undefined;
    };
    outputTokens: {
      total: number | undefined;
      text: number | undefined;
      reasoning: number | undefined;
    };
  };
  warnings?: unknown[];
}

export interface ScriptedLanguageModel extends LanguageModel {
  /** Every doGenerate call options, in order — assert on prompt/tools from tests. */
  calls: unknown[];
}

export function createScriptedModel(steps: ScriptedModelStep[]): ScriptedLanguageModel {
  const calls: unknown[] = [];
  let index = 0;
  return {
    specificationVersion: 'v3',
    provider: 'mock-copilot',
    modelId: 'mock-copilot-1',
    calls,
    async doGenerate(options: unknown) {
      calls.push(options);
      const step = steps[Math.min(index, steps.length - 1)];
      index += 1;
      return step;
    },
  } as unknown as ScriptedLanguageModel;
}

export function toolCallStep(toolName: string, input: unknown): ScriptedModelStep {
  return {
    content: [
      {
        type: 'tool-call',
        toolCallId: `call-${Math.random().toString(36).slice(2, 10)}`,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
    usage: {
      inputTokens: { total: 120, noCache: 120, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 30, text: 30, reasoning: undefined },
    },
    warnings: [],
  };
}

export function textStep(text: string): ScriptedModelStep {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 150, noCache: 150, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 60, text: 60, reasoning: undefined },
    },
    warnings: [],
  };
}
