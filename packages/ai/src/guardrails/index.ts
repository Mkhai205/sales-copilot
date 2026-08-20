export enum AutonomyLevel {
  OFF = 'OFF',
  ASSISTED = 'ASSISTED',
  AUTONOMOUS = 'AUTONOMOUS',
}

export interface GuardrailPolicy {
  autonomyLevel: AutonomyLevel;
  minConfidenceThreshold: number;
  allowedTools: string[];
  requireHumanConfirmationFor: string[];
  maxDailyActionsPerLead?: number;
}

export interface GuardrailEvaluation {
  allowed: boolean;
  requiresHumanConfirmation: boolean;
  reason?: string;
  confidenceScore: number;
}

export class GuardrailViolationError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly reason: string,
    public readonly confidenceScore?: number,
  ) {
    super(`Guardrail policy violation for tool '${toolName}': ${reason}`);
    this.name = 'GuardrailViolationError';
  }
}
