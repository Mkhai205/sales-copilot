/**
 * Utility for sanitizing variable inputs against prompt injection attacks.
 */
export class PromptSanitizer {
  private static readonly INJECTION_PATTERNS = [
    // Delimiter overrides
    /(?:\r?\n|^)\s*(?:system|system\s+prompt|###\s*instruction|###\s*system|\[system\]|human:|assistant:)\s*:/gi,
    // Hijack commands
    /ignore\s+(?:all\s+)?(?:previous|prior|system|above)\s+instructions/gi,
    /disregard\s+(?:all\s+)?(?:previous|prior|system|above)\s+instructions/gi,
    /you\s+are\s+now\s+(?:in\s+)?developer\s+mode/gi,
    /dan\s+mode/gi,
    /jailbreak/gi,
  ];

  /**
   * Neutralizes prompt injection phrases and escaping markers.
   */
  static sanitize(input: any): string {
    if (input === null || input === undefined) {
      return '';
    }

    let text = typeof input === 'string' ? input : JSON.stringify(input);

    for (const pattern of this.INJECTION_PATTERNS) {
      text = text.replace(pattern, (match: string) => `[SANITIZED: ${match.trim()}]`);
    }

    return text;
  }

  /**
   * Sanitizes all entries in a variables dictionary.
   */
  static sanitizeVariables(variables: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(variables)) {
      result[key] = this.sanitize(val);
    }
    return result;
  }
}
