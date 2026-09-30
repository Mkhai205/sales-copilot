'use client';

import { MessageSquare, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
} from '@/components/ui/message-scroller';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message';
import { cn } from '@/lib/utils';

import type { WebChatPreviewSimulatorProps } from './web-chat-preview';

export function WebChatPreviewMobile({
  widgetColor,
  inboxTitle,
  tagline,
  isOpen,
  onOpenChange,
  activeTab,
  preChatEnabled,
  preChatRequirePhone,
  preChatRequireEmail,
  showNameField,
  formError,
  formName,
  onFormNameChange,
  formPhone,
  onFormPhoneChange,
  formEmail,
  onFormEmailChange,
  onPreChatSubmit,
  messages,
  isAgentTyping,
  inputText,
  onInputTextChange,
  onSendMessage,
}: WebChatPreviewSimulatorProps) {
  return (
    <div className="relative w-[300px] h-[540px] rounded-[36px] border-4 border-slate-700 bg-slate-900 shadow-2xl p-2.5 flex flex-col">
      {/* Notch */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 h-3.5 w-24 rounded-full bg-slate-800 z-20" />

      {/* Phone Screen */}
      <div className="relative flex-1 rounded-[26px] bg-background overflow-hidden flex flex-col">
        {/* Status bar */}
        <div className="h-6 flex items-center justify-between px-5 text-[9px] text-muted-foreground border-b border-border/40 select-none">
          <span>9:41</span>
          <span>5G 100%</span>
        </div>

        {/* Chat View occupying full mobile screen */}
        {isOpen ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div
              className="p-3 text-white flex items-center justify-between shrink-0 shadow-xs"
              style={{ backgroundColor: widgetColor }}
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold leading-tight truncate max-w-[190px]">
                  {inboxTitle}
                </span>
                <span className="text-[10px] opacity-85 leading-tight">{tagline}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-auto size-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-3.5" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-900/60">
              {preChatEnabled && activeTab === 'prechat' ? (
                <form
                  onSubmit={onPreChatSubmit}
                  className="flex-1 p-3.5 flex flex-col justify-between overflow-y-auto"
                >
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Vui lòng cung cấp thông tin để bắt đầu trò chuyện:
                    </p>

                    {formError && (
                      <p className="text-[11px] text-destructive font-medium bg-destructive/10 p-1.5 rounded">
                        {formError}
                      </p>
                    )}

                    {showNameField && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-foreground flex items-center gap-0.5">
                          Họ và tên <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          value={formName}
                          onChange={e => onFormNameChange(e.target.value)}
                          placeholder="Ví dụ: Nguyễn Văn A"
                          className="w-full h-7 rounded border border-border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )}

                    {preChatRequirePhone && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-foreground flex items-center gap-0.5">
                          Số điện thoại <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="tel"
                          value={formPhone}
                          onChange={e => onFormPhoneChange(e.target.value)}
                          placeholder="Ví dụ: 0912345678"
                          className="w-full h-7 rounded border border-border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )}

                    {preChatRequireEmail && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-foreground flex items-center gap-0.5">
                          Email <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="email"
                          value={formEmail}
                          onChange={e => onFormEmailChange(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full h-7 rounded border border-border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-8 text-xs font-medium text-white shadow-xs mt-3"
                    style={{ backgroundColor: widgetColor }}
                  >
                    Bắt đầu trò chuyện
                  </Button>
                </form>
              ) : (
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  {/* Messages List with Shadcn MessageScroller */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <MessageScroller autoScroll defaultScrollPosition="end" className="h-full">
                      <MessageScrollerViewport className="p-2.5">
                        <MessageScrollerContent className="gap-2">
                          <MessageScrollerItem className="min-w-0">
                            <div className="rounded-lg bg-card border border-border/80 p-2 text-[10px] text-muted-foreground shadow-2xs leading-relaxed">
                              👋 Chào mừng bạn đến với cửa hàng! Hãy để lại tin nhắn nếu bạn cần trợ
                              giúp.
                            </div>
                          </MessageScrollerItem>

                          {messages.map(msg => (
                            <MessageScrollerItem key={msg.id} className="min-w-0">
                              <Message align={msg.sender === 'user' ? 'end' : 'start'}>
                                <MessageContent>
                                  <div
                                    className={cn(
                                      'rounded-2xl px-2.5 py-1.5 text-xs max-w-[85%] leading-relaxed',
                                      msg.sender === 'user'
                                        ? 'rounded-br-xs text-white self-end'
                                        : 'rounded-bl-xs bg-card border border-border text-foreground self-start',
                                    )}
                                    style={
                                      msg.sender === 'user'
                                        ? { backgroundColor: widgetColor }
                                        : undefined
                                    }
                                  >
                                    {msg.text}
                                  </div>
                                  <MessageFooter className="text-[8px] mt-0.5 px-1">
                                    {msg.time}
                                  </MessageFooter>
                                </MessageContent>
                              </Message>
                            </MessageScrollerItem>
                          ))}

                          {isAgentTyping && (
                            <MessageScrollerItem className="min-w-0">
                              <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-2 py-1 w-fit">
                                <span className="size-1 rounded-full bg-muted-foreground animate-bounce" />
                                <span className="size-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
                                <span className="size-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.4s]" />
                              </div>
                            </MessageScrollerItem>
                          )}
                        </MessageScrollerContent>
                      </MessageScrollerViewport>
                    </MessageScroller>
                  </div>

                  <form
                    onSubmit={onSendMessage}
                    className="px-1.5 pb-3 pt-2 border-t border-border bg-background flex items-center gap-1"
                  >
                    <input
                      type="text"
                      value={inputText}
                      onChange={e => onInputTextChange(e.target.value)}
                      placeholder="Gõ tin nhắn..."
                      className="flex-1 h-7 rounded border border-border px-2 text-[11px] bg-background text-foreground outline-none"
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      className="h-auto w-auto size-7 rounded flex items-center justify-center text-white disabled:opacity-40 shrink-0"
                      disabled={!inputText.trim()}
                      style={{ backgroundColor: widgetColor }}
                    >
                      <Send className="size-3" />
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative flex-1 p-4 bg-muted/20 flex flex-col justify-between">
            <div className="space-y-2 opacity-30 select-none">
              <div className="h-4 w-24 rounded bg-muted-foreground/30" />
              <div className="h-6 w-full rounded bg-muted-foreground/20" />
              <div className="h-24 w-full rounded bg-muted-foreground/15" />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-auto size-12 rounded-full text-white shadow-xl flex items-center justify-center"
                onClick={() => onOpenChange(true)}
                style={{ backgroundColor: widgetColor }}
              >
                <MessageSquare className="size-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
