'use client';

import * as React from 'react';
import { WsServerEvent } from '@sales-copilot/shared-contracts';
import { fetchApi, workspaceHeaders } from '@/lib/api/client';
import { useSocketEvent } from '@/lib/socket';

export interface UseCopilotStreamOptions {
  conversationId?: string;
  workspaceId?: string;
  onFinish?: (fullText: string) => void;
}

export function useCopilotStream({
  conversationId,
  workspaceId,
  onFinish,
}: UseCopilotStreamOptions) {
  const [streamingText, setStreamingText] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onFinishRef = React.useRef(onFinish);
  React.useEffect(() => {
    onFinishRef.current = onFinish;
  });

  // Listen for chunks arriving via WebSocket room `conversation_${conversationId}`
  useSocketEvent<any>(WsServerEvent.COPILOT_SUGGESTION_CHUNK, payload => {
    const data = payload?.data || payload;
    if (data?.conversationId !== conversationId) return;

    if (data?.chunk) {
      setStreamingText(prev => prev + data.chunk);
    }

    if (data?.isFinished) {
      setIsStreaming(false);
      if (data.fullContent) {
        setStreamingText(data.fullContent);
      }
      const completedText = data.fullContent || streamingText;
      onFinishRef.current?.(completedText);
    }
  });

  const startStreaming = React.useCallback(
    async (customInstruction?: string) => {
      if (!workspaceId || !conversationId) return;

      setIsStreaming(true);
      setStreamingText('');
      setError(null);

      try {
        await fetchApi(
          `/workspaces/${workspaceId}/copilot/conversations/${conversationId}/stream-reply`,
          {
            method: 'POST',
            headers: workspaceHeaders(workspaceId),
            body: JSON.stringify({ customInstruction }),
          },
        );
      } catch (err: any) {
        setIsStreaming(false);
        setError(err.message || 'Không thể bắt đầu luồng sinh câu trả lời');
      }
    },
    [workspaceId, conversationId],
  );

  const reset = React.useCallback(() => {
    setStreamingText('');
    setIsStreaming(false);
    setError(null);
  }, []);

  return {
    streamingText,
    isStreaming,
    error,
    startStreaming,
    reset,
  };
}
