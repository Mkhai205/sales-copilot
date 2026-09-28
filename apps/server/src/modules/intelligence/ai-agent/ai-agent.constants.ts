export const AI_AGENT_CONSTANTS = {
  DEFAULT_DEBOUNCE_DELAY_MS: 500,
  DEBOUNCE_KEY_TTL_SECONDS: 60,
  DEFAULT_MAX_STEPS: 10,
  DEFAULT_TEMPERATURE: 0.3,
  DEFAULT_MODEL: 'gemini-2.5-flash',
  MAX_HISTORY_MESSAGES: 20,
  FALLBACK_MESSAGE: 'Em chưa thể xử lý yêu cầu này, để em chuyển cho nhân viên hỗ trợ ạ.',

  // Guardrails & Rate limiting
  RATE_LIMIT_PER_MINUTE: 5,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  RATE_LIMIT_WARN_MESSAGE: 'Anh/chị vui lòng chờ em xử lý tin nhắn trước ạ 😊',
  RATE_LIMIT_WARN_TTL_SECONDS: 60,
  BLACKLIST_REPLY_MESSAGE: 'Em không hỗ trợ nội dung này ạ',
  ABUSE_CONSECUTIVE_LIMIT: 3,
  ABUSE_SHORT_MSG_MAX_LENGTH: 2,
  ABUSE_STATE_TTL_SECONDS: 120,

  // Follow-up
  FOLLOW_UP_DELAY_MS: 5 * 60 * 1000,
  FOLLOW_UP_MESSAGE: 'Anh/chị còn cần hỗ trợ gì không ạ? 😊',
  FOLLOW_UP_JOB_NAME: 'follow-up',
} as const;

interface ModelPricingConfig {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

const AI_MODEL_PRICING: Record<string, ModelPricingConfig> = {
  'gemini-2.5-flash': {
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
  },
};

export function calculateEstimatedCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = AI_MODEL_PRICING[model] || AI_MODEL_PRICING[AI_AGENT_CONSTANTS.DEFAULT_MODEL];
  const cost =
    (Math.max(0, inputTokens) * pricing.inputPricePerMillion +
      Math.max(0, outputTokens) * pricing.outputPricePerMillion) /
    1_000_000;
  return Math.round(cost * 1e7) / 1e7;
}

export function getAiDebounceKey(workspaceId: string, conversationId: string): string {
  return `ws:${workspaceId}:ai:debounce:${conversationId}`;
}

export function getAiRateLimitKey(
  workspaceId: string,
  conversationId: string,
  bucketMinute = Math.floor(Date.now() / 60000),
): string {
  return `ws:${workspaceId}:ai:ratelimit:${conversationId}:${bucketMinute}`;
}

export function getAiRateLimitWarnedKey(workspaceId: string, conversationId: string): string {
  return `ws:${workspaceId}:ai:ratelimit-warned:${conversationId}`;
}

export function getAiAbuseKey(workspaceId: string, conversationId: string): string {
  return `ws:${workspaceId}:ai:abuse:${conversationId}`;
}

// Regex specifically targeting extreme profanity / toxic abuse without false positives
export const CONTENT_BLACKLIST_REGEX =
  /đụ\s*m[áàảãạ]|đ[éèẻẽẹ]o\s*m[eẹ]|đ[ií]t\s*m[eẹ]|c[áàảãạ]i\s*l[ồô]n|c[áàảãạ]i\s*đ[ií]t/iu;

export const PERSONA_TONE_DESCRIPTIONS: Record<string, string> = {
  shop_ban: 'Shop - Bạn (gần gũi, trẻ trung, tự nhiên)',
  em_anh_chi: 'Em - Anh/Chị (lễ phép, chu đáo, chuẩn mực bán hàng)',
  minh_ban: 'Mình - Bạn (thân thiện, bình đẳng)',
  chuyen_vien: 'Chuyên viên tư vấn - Quý khách (trang trọng, chuyên nghiệp, chuẩn mực)',
};

export class HumanTakeoverAbortError extends Error {
  constructor(message = 'HUMAN_TAKEOVER') {
    super(message);
    this.name = 'HumanTakeoverAbortError';
  }
}
