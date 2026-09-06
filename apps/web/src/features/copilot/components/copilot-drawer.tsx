'use client';

import * as React from 'react';
import { Sparkles, RefreshCw, Send, ShieldAlert, Target, MessageSquare, Zap } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import type { CopilotSuggestionDto } from '@sales-copilot/shared-contracts';
import { ReplyDraftCard } from './reply-draft-card';
import { ActionCard } from './action-card';
import { BattlecardCard } from './battlecard-card';
import { useCopilotSuggestions, useGenerateSuggestions } from '../hooks/use-copilot-suggestions';
import { useCopilotStream } from '../hooks/use-copilot-stream';
import { insertIntoComposer } from '../../composer';

export interface CopilotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  conversationId: string;
}

export function CopilotDrawer({
  open,
  onOpenChange,
  workspaceId,
  conversationId,
}: CopilotDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<'replies' | 'actions' | 'battlecards'>(
    'replies',
  );
  const [customPrompt, setCustomPrompt] = React.useState('');

  const { data: suggestions = [], isLoading } = useCopilotSuggestions({
    workspaceId,
    conversationId,
    enabled: open,
  });

  const { mutate: generateSuggestions, isPending: isGenerating } = useGenerateSuggestions(
    workspaceId,
    conversationId,
  );

  const {
    streamingText,
    isStreaming,
    startStreaming,
    reset: resetStream,
  } = useCopilotStream({
    conversationId,
    workspaceId,
  });

  // Filter suggestions by type
  const replyDrafts = suggestions.filter(s => s.suggestionType === 'REPLY_DRAFT');
  const actions = suggestions.filter(s => s.suggestionType === 'NEXT_BEST_ACTION');
  const battlecards = suggestions.filter(s => s.suggestionType === 'BATTLECARD');

  const handleStartStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim() && !isStreaming) {
      startStreaming();
    } else {
      startStreaming(customPrompt.trim());
    }
  };

  const handleInsertStreamedText = () => {
    if (streamingText) {
      insertIntoComposer({
        conversationId,
        text: streamingText,
        mode: 'append',
      });
      resetStream();
      setCustomPrompt('');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-md p-0 gap-0 border-l border-border bg-background"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-4 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold">Sales Copilot</SheetTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Sẵn sàng hỗ trợ
                  </span>
                </div>
              </div>
            </div>

            <Button
              size="icon-xs"
              variant="outline"
              onClick={() => generateSuggestions({ force: true })}
              disabled={isGenerating || isLoading}
              className="size-7"
              title="Làm mới đề xuất"
            >
              <RefreshCw className={isGenerating ? 'size-3.5 animate-spin' : 'size-3.5'} />
            </Button>
          </div>
        </SheetHeader>

        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={v => setActiveTab(v as any)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="px-4 pt-3 border-b border-border/40">
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="replies" className="text-xs gap-1.5">
                <MessageSquare className="size-3" />
                <span>Bản thảo</span>
                {replyDrafts.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                    {replyDrafts.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="actions" className="text-xs gap-1.5">
                <Target className="size-3" />
                <span>Hành động</span>
                {actions.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                    {actions.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="battlecards" className="text-xs gap-1.5">
                <ShieldAlert className="size-3" />
                <span>Cẩm nang</span>
                {battlecards.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                    {battlecards.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Replies */}
          <TabsContent value="replies" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
            {/* Live Streaming Generator Bar */}
            <form onSubmit={handleStartStream} className="flex gap-1.5 mb-3">
              <Input
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Nhập yêu cầu tùy biến câu trả lời..."
                className="h-8 text-xs"
                disabled={isStreaming}
              />
              <Button
                type="submit"
                size="sm"
                className="h-8 px-3 text-xs gap-1 bg-primary text-primary-foreground shrink-0"
                disabled={isStreaming}
              >
                {isStreaming ? <Spinner className="size-3.5" /> : <Zap className="size-3.5" />}
                <span>{isStreaming ? 'Đang viết...' : 'Viết nhanh'}</span>
              </Button>
            </form>

            {/* Stream View */}
            {(isStreaming || streamingText) && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3.5 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5" />
                    <span>AI đang tạo câu trả lời trực tiếp...</span>
                  </div>
                  {isStreaming && <Spinner className="size-3" />}
                </div>

                <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-background/80 rounded-md p-2.5 border border-border">
                  {streamingText}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse" />
                  )}
                </div>

                {!isStreaming && streamingText && (
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={resetStream}
                      className="h-7 text-xs text-muted-foreground"
                    >
                      Xóa
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={handleInsertStreamedText}
                      className="h-7 text-xs gap-1"
                    >
                      <Send className="size-3" />
                      Chèn vào khung chat
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Draft Cards List */}
            {replyDrafts.length > 0
              ? replyDrafts.map(suggestion => (
                  <ReplyDraftCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    workspaceId={workspaceId}
                    conversationId={conversationId}
                  />
                ))
              : !isStreaming &&
                !streamingText && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <MessageSquare className="size-8 stroke-[1.5] text-muted-foreground/50 mb-2" />
                    <p className="text-xs font-medium">Chưa có bản thảo trả lời nào</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-[200px]">
                      Hệ thống sẽ tự động tạo bản thảo ngay khi khách hàng gửi tin nhắn mới.
                    </p>
                  </div>
                )}
          </TabsContent>

          {/* Tab 2: Actions */}
          <TabsContent value="actions" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
            {actions.length > 0 ? (
              actions.map(suggestion => (
                <ActionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  workspaceId={workspaceId}
                  conversationId={conversationId}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Target className="size-8 stroke-[1.5] text-muted-foreground/50 mb-2" />
                <p className="text-xs font-medium">Không có hành động đề xuất</p>
                <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-[200px]">
                  Copilot sẽ đề xuất chuyển đổi deal hoặc đặt hẹn khi phát hiện tín hiệu mua hàng.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Battlecards */}
          <TabsContent value="battlecards" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
            {battlecards.length > 0 ? (
              battlecards.map(suggestion => (
                <BattlecardCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  workspaceId={workspaceId}
                  conversationId={conversationId}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <ShieldAlert className="size-8 stroke-[1.5] text-muted-foreground/50 mb-2" />
                <p className="text-xs font-medium">Không phát hiện đối thủ hoặc từ chối giá</p>
                <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-[200px]">
                  Cẩm nang đối ứng sẽ xuất hiện khi khách hàng đề cập đối thủ cạnh tranh hoặc từ
                  chối giá.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
