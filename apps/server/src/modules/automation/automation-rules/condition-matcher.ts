import {
  AutomationAttribute,
  AutomationCondition,
  AutomationOperator,
} from '@sales-copilot/shared-contracts';

export interface RuleEvaluationContext {
  conversation: {
    id: string;
    workspaceId: string;
    inboxId?: string | null;
    teamId?: string | null;
    assigneeId?: string | null;
    status?: string | null;
    priority?: string | null;
    messages?: Array<{ content?: string | null }>;
    [key: string]: any;
  };
  message?: {
    id?: string;
    content?: string | null;
    senderType?: string | null;
    isPrivate?: boolean;
    [key: string]: any;
  } | null;
}

/**
 * ConditionMatcher handles evaluating DSL conditions against conversation & message entity contexts.
 */
export class ConditionMatcher {
  /**
   * Matches all conditions in a rule against the provided context.
   * Uses AND logic (all conditions must match).
   */
  static match(context: RuleEvaluationContext, conditions?: AutomationCondition[] | null): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every(condition => this.matchSingleCondition(context, condition));
  }

  /**
   * Evaluates a single condition against the context.
   */
  static matchSingleCondition(
    context: RuleEvaluationContext,
    condition: AutomationCondition,
  ): boolean {
    const rawValue = this.extractAttribute(context, condition.attribute);
    const values = condition.values || [];

    switch (condition.operator) {
      case AutomationOperator.EQUAL:
        return this.evalEqual(rawValue, values);

      case AutomationOperator.NOT_EQUAL:
        return !this.evalEqual(rawValue, values);

      case AutomationOperator.CONTAINS:
        return this.evalContains(rawValue, values);

      case AutomationOperator.NOT_CONTAINS:
        return !this.evalContains(rawValue, values);

      case AutomationOperator.IS_PRESENT:
        return this.evalIsPresent(rawValue);

      case AutomationOperator.IS_NOT_PRESENT:
        return !this.evalIsPresent(rawValue);

      default:
        return false;
    }
  }

  /**
   * Extracts the target attribute value from the evaluation context.
   */
  static extractAttribute(
    context: RuleEvaluationContext,
    attribute: AutomationAttribute,
  ): string | null | undefined {
    switch (attribute) {
      case AutomationAttribute.STATUS:
        return context.conversation?.status;

      case AutomationAttribute.INBOX_ID:
        return context.conversation?.inboxId;

      case AutomationAttribute.TEAM_ID:
        return context.conversation?.teamId;

      case AutomationAttribute.ASSIGNEE_ID:
        return context.conversation?.assigneeId;

      case AutomationAttribute.PRIORITY:
        return context.conversation?.priority;

      case AutomationAttribute.CONTENT:
        if (context.message?.content !== undefined && context.message?.content !== null) {
          return context.message.content;
        }
        if (context.conversation?.messages && context.conversation.messages.length > 0) {
          return context.conversation.messages[0].content;
        }
        return null;

      case AutomationAttribute.SENDER_TYPE:
        return context.message?.senderType ?? null;

      default:
        return null;
    }
  }

  private static evalEqual(entityValue: unknown, targetValues: string[]): boolean {
    if (entityValue === null || entityValue === undefined) {
      return false;
    }
    const strVal = String(entityValue).trim().toLowerCase();
    return targetValues.some(val => val.trim().toLowerCase() === strVal);
  }

  private static evalContains(entityValue: unknown, targetValues: string[]): boolean {
    if (entityValue === null || entityValue === undefined) {
      return false;
    }
    if (targetValues.length === 0) {
      return false;
    }
    const strVal = String(entityValue).toLowerCase();
    return targetValues.some(val => strVal.includes(val.toLowerCase()));
  }

  private static evalIsPresent(entityValue: unknown): boolean {
    if (entityValue === null || entityValue === undefined) {
      return false;
    }
    return String(entityValue).trim() !== '';
  }
}
