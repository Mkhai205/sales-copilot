export const AI_AGENT_CONSTANTS = {
  DEFAULT_DEBOUNCE_DELAY_MS: 500,
  DEBOUNCE_KEY_TTL_SECONDS: 60,
  DEFAULT_MAX_STEPS: 10,
  DEFAULT_TEMPERATURE: 0.3,
  DEFAULT_MODEL: 'gemini-2.5-flash',
  MAX_HISTORY_MESSAGES: 20,
  FALLBACK_MESSAGE: 'Em chưa thể xử lý yêu cầu này, để em chuyển cho nhân viên hỗ trợ ạ.',
} as const;

export function getAiDebounceKey(workspaceId: string, conversationId: string): string {
  return `ws:${workspaceId}:ai:debounce:${conversationId}`;
}

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
