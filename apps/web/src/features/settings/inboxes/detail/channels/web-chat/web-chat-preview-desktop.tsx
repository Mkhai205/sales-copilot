'use client';

import { MessageSquare, Send, ShieldCheck, X } from 'lucide-react';
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

export function WebChatPreviewDesktop({
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
    <div className="relative w-full max-w-[480px] h-[500px] rounded-lg border border-border bg-background shadow-md overflow-hidden flex flex-col">
      {/* Browser top chrome */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-red-400" />
          <div className="size-2.5 rounded-full bg-amber-400" />
          <div className="size-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground font-mono w-48 justify-center truncate">
          <ShieldCheck className="size-3 text-emerald-500 shrink-0" />
          <span>https://your-shop.com</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Simulated Website Content */}
      <div className="relative flex-1 p-5 bg-gradient-to-b from-background to-muted/20 overflow-hidden">
        <div className="space-y-3 opacity-40 select-none pointer-events-none">
          <div className="h-4 w-32 rounded bg-muted-foreground/30" />
          <div className="h-8 w-3/4 rounded bg-muted-foreground/20" />
          <div className="h-3 w-5/6 rounded bg-muted-foreground/20" />
          <div className="h-3 w-2/3 rounded bg-muted-foreground/20" />
          <div className="mt-6 flex gap-2">
            <div className="h-7 w-20 rounded bg-muted-foreground/25" />
            <div className="h-7 w-20 rounded bg-muted-foreground/15" />
          </div>
        </div>

        {/* Chat Window Floating on bottom-right */}
        {isOpen && (
          <div className="absolute bottom-16 right-4 w-[310px] h-[370px] rounded-xl border border-border/80 bg-background shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Widget Header */}
            <div
              className="p-3 text-white flex items-center justify-between shrink-0 shadow-xs"
              style={{ backgroundColor: widgetColor }}
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold leading-tight truncate max-w-[200px]">
                  {inboxTitle}
                </span>
                <span className="text-[10px] opacity-85 leading-tight">{tagline}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-auto size-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white"
                onClick={() => onOpenChange(false)}
                title="Đóng chat"
              >
                <X className="size-3.5" />
              </Button>
            </div>

            {/* Widget Body: Pre-chat vs Messages */}
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
                      <MessageScrollerViewport className="p-3">
                        <MessageScrollerContent className="gap-2.5">
                          <MessageScrollerItem className="min-w-0">
                            <div className="rounded-lg bg-card border border-border/80 p-2 text-[11px] text-muted-foreground shadow-2xs leading-relaxed">
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
                                      'rounded-2xl px-3 py-1.5 text-xs max-w-[85%] leading-relaxed',
                                      msg.sender === 'user'
                                        ? 'rounded-br-xs text-white self-end'
                                        : 'rounded-bl-xs bg-card border border-border text-foreground shadow-2xs self-start',
                                    )}
                                    style={
                                      msg.sender === 'user'
                                        ? { backgroundColor: widgetColor }
                                        : undefined
                                    }
                                  >
                                    {msg.text}
                                  </div>
                                  <MessageFooter className="text-[9px] mt-0.5 px-1">
                                    {msg.time}
                                  </MessageFooter>
                                </MessageContent>
                              </Message>
                            </MessageScrollerItem>
                          ))}

                          {isAgentTyping && (
                            <MessageScrollerItem className="min-w-0">
                              <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-2.5 py-1.5 w-fit shadow-2xs">
                                <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" />
                                <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
                                <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.4s]" />
                              </div>
                            </MessageScrollerItem>
                          )}
                        </MessageScrollerContent>
                      </MessageScrollerViewport>
                    </MessageScroller>
                  </div>

                  {/* Input bar */}
                  <form
                    onSubmit={onSendMessage}
                    className="p-2 border-t border-border bg-background flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={inputText}
                      onChange={e => onInputTextChange(e.target.value)}
                      placeholder="Gõ tin nhắn thử nghiệm..."
                      className="flex-1 h-7 rounded border border-border px-2 text-[11px] bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      className="h-auto w-auto size-7 rounded flex items-center justify-center text-white disabled:opacity-40 transition-opacity shrink-0"
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
        )}

        {/* Launcher Bubble on bottom-right */}
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-auto absolute bottom-4 right-4 size-11 rounded-full text-white shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
          onClick={() => onOpenChange(!isOpen)}
          style={{ backgroundColor: widgetColor }}
          title={isOpen ? 'Đóng widget' : 'Mở widget'}
        >
          {isOpen ? (
            <X className="size-5" />
          ) : (
            <>
              <MessageSquare className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-rose-500 border-2 border-background text-[9px] font-bold flex items-center justify-center text-white">
                1
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
