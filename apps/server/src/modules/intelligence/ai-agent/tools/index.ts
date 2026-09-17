import type { ToolSet } from 'ai';

export interface ToolBuildContext {
  workspaceId: string;
  conversationId: string;
  policy?: Record<string, unknown>;
}

/**
 * Builds registered tools available for the AI Agent loop.
 * Epic 3.1: Framework registry placeholder. Commerce Tools will be plugged in via Epic 3.2.
 */
export function buildAgentTools(_context: ToolBuildContext): ToolSet {
  return {};
}
