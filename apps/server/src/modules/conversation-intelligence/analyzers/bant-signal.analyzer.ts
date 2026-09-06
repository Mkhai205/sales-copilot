import { Injectable, Logger } from '@nestjs/common';
import { BuyingSignalType, DetectedSignalDto } from '@sales-copilot/shared-contracts';

export interface VerifiedSignal {
  signalType: BuyingSignalType;
  confidence: number;
  snippet: string;
  reasoning: string;
  metadata: Record<string, unknown>;
}

@Injectable()
export class BantSignalAnalyzer {
  private readonly logger = new Logger(BantSignalAnalyzer.name);
  static readonly MIN_CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Cleans punctuation, markdown, quotes and whitespace from candidate snippet.
   */
  cleanSnippet(str: string): string {
    return str
      .replace(/^[\s"'“‘«`*_]+|[\s"'”’»`*_]+$/g, '')
      .replace(/[.,!?;:…]+$/, '')
      .trim();
  }

  /**
   * Verifies that the LLM snippet is an actual verbatim substring of the message text.
   * Prevents LLM hallucinations from being recorded as verified sales evidence.
   * Guarantees that any non-null return value is an EXACT substring of fullText (fullText.includes(result) === true).
   */
  verifyAndNormalizeSnippet(snippet: string, fullText: string): string | null {
    if (!snippet || !fullText) return null;

    const cleanedSnippet = this.cleanSnippet(snippet);
    if (!cleanedSnippet) return null;

    // 1. Direct exact match
    if (fullText.includes(cleanedSnippet)) {
      return cleanedSnippet;
    }

    // 2. Case-insensitive exact match -> return the exact casing slice from source fullText
    const lowerFullText = fullText.toLowerCase();
    const lowerSnippet = cleanedSnippet.toLowerCase();
    const index = lowerFullText.indexOf(lowerSnippet);
    if (index !== -1) {
      const slice = fullText.substring(index, index + cleanedSnippet.length);
      if (fullText.includes(slice)) return slice;
    }

    // 3. Trim trailing punctuation from snippet and try exact/case-insensitive slice
    const withoutTrailingPunct = cleanedSnippet.replace(/[.,!?;:…]+$/, '').trim();
    if (withoutTrailingPunct.length > 0) {
      if (fullText.includes(withoutTrailingPunct)) {
        return withoutTrailingPunct;
      }
      const lowerWithoutPunct = withoutTrailingPunct.toLowerCase();
      const idxWithoutPunct = lowerFullText.indexOf(lowerWithoutPunct);
      if (idxWithoutPunct !== -1) {
        const slice = fullText.substring(
          idxWithoutPunct,
          idxWithoutPunct + withoutTrailingPunct.length,
        );
        if (fullText.includes(slice)) return slice;
      }
    }

    // 4. Word-boundary regex match across arbitrary whitespace/newlines/inner punctuation
    // Extracts the real substring slice from fullText matching the word sequence
    const words = (withoutTrailingPunct.length > 0 ? withoutTrailingPunct : cleanedSnippet)
      .split(/\s+/)
      .filter(Boolean);

    if (words.length > 0) {
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = words
        .map(w => escape(w.replace(/^[.,!?;:…]+|[.,!?;:…]+$/g, '')))
        .filter(Boolean)
        .join('[.,!?;:…\\s]+');

      if (pattern.length > 0) {
        try {
          const regex = new RegExp(pattern, 'i');
          const match = fullText.match(regex);
          if (match && match[0] && fullText.includes(match[0])) {
            return match[0];
          }
        } catch {
          // Fall through on regex compilation error
        }
      }
    }

    this.logger.debug(
      `Hallucination rejected: snippet "${cleanedSnippet}" not found in source text "${fullText.slice(0, 100)}..."`,
    );
    return null;
  }

  /**
   * Filters and normalizes detected signals:
   * 1. Filters out signals with confidence < 0.70.
   * 2. Maps TIMELINE_STATED to TIMELINE_DEFINED.
   * 3. Verifies verbatim snippet matching against message body.
   */
  verifySignals(rawSignals: DetectedSignalDto[], messageContent: string): VerifiedSignal[] {
    const verified: VerifiedSignal[] = [];

    for (const signal of rawSignals) {
      // 1. Threshold check
      if (signal.confidence < BantSignalAnalyzer.MIN_CONFIDENCE_THRESHOLD) {
        this.logger.debug(
          `Signal ${signal.signalType} discarded due to low confidence (${signal.confidence} < ${BantSignalAnalyzer.MIN_CONFIDENCE_THRESHOLD})`,
        );
        continue;
      }

      // 2. Normalize TIMELINE_STATED -> TIMELINE_DEFINED
      let signalType = signal.signalType;
      if ((signalType as string) === 'TIMELINE_STATED') {
        signalType = BuyingSignalType.TIMELINE_DEFINED;
      }

      // 3. Verbatim snippet verification
      const verifiedSnippet = this.verifyAndNormalizeSnippet(signal.snippet, messageContent);
      if (!verifiedSnippet) {
        this.logger.warn(
          `Discarded unverified signal ${signalType}: snippet "${signal.snippet}" does not exist in message`,
        );
        continue;
      }

      verified.push({
        signalType,
        confidence: signal.confidence,
        snippet: verifiedSnippet,
        reasoning: signal.reasoning || '',
        metadata: signal.metadata || {},
      });
    }

    return verified;
  }
}
