'use client';

import * as React from 'react';
import {
  Monitor,
  Smartphone,
  MessageSquare,
  Send,
  RotateCcw,
  X,
  Sparkles,
  ShieldCheck,
  Code2,
  Copy,
  Check,
  FileCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
} from '@/components/ui/message-scroller';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message';
import { cn } from '@/lib/utils';

interface WebChatPreviewProps {
  widgetColor: string;
  inboxTitle?: string;
  tagline?: string;
  preChatEnabled: boolean;
  preChatRequireName: boolean;
  preChatRequireEmail: boolean;
  preChatRequirePhone: boolean;
  embedScript?: string;
  websiteToken?: string;
}

interface TestMessage {
  id: string;
  sender: 'agent' | 'user';
  text: string;
  time: string;
}

const INITIAL_MESSAGES: TestMessage[] = [
  {
    id: 'm1',
    sender: 'agent',
    text: 'Chào bạn! Tôi có thể hỗ trợ thông tin gì cho bạn hôm nay?',
    time: '12:00',
  },
];

const DEFAULT_EMBED_SCRIPT = `<!-- Start Sales Copilot Live Chat -->
<script>
  (function(d,t) {
    var BASE_URL = "http://localhost:3000";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/widget/sdk.js";
    g.defer = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.SalesCopilotWidget.init({
        inboxId: "your-inbox-id",
        websiteToken: "your-website-token",
        baseUrl: BASE_URL
      });
    };
  })(document,"script");
</script>
<!-- End Sales Copilot Live Chat -->`;

export function WebChatPreview({
  widgetColor,
  inboxTitle = 'Sales Copilot Live Chat',
  tagline = 'Thường phản hồi trong vài phút',
  preChatEnabled,
  preChatRequireName,
  preChatRequireEmail,
  preChatRequirePhone,
  embedScript = DEFAULT_EMBED_SCRIPT,
}: WebChatPreviewProps) {
  const [viewMode, setViewMode] = React.useState<'desktop' | 'mobile' | 'script'>('desktop');
  const [isCopied, setIsCopied] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'prechat' | 'messages'>(
    preChatEnabled ? 'prechat' : 'messages',
  );

  const handleCopyEmbedScript = () => {
    navigator.clipboard.writeText(embedScript);
    setIsCopied(true);
    toast.success('Đã sao chép mã nhúng Website Live Chat');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Form values in preview
  const [formName, setFormName] = React.useState('');
  const [formPhone, setFormPhone] = React.useState('');
  const [formEmail, setFormEmail] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  // Chat messages
  const [messages, setMessages] = React.useState<TestMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = React.useState('');
  const [isAgentTyping, setIsAgentTyping] = React.useState(false);

  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const prevPreChatEnabledRef = React.useRef(preChatEnabled);

  // Sync activeTab when preChatEnabled changes: switch to prechat when enabled, or messages when disabled
  React.useEffect(() => {
    if (prevPreChatEnabledRef.current !== preChatEnabled) {
      prevPreChatEnabledRef.current = preChatEnabled;
      setActiveTab(preChatEnabled ? 'prechat' : 'messages');
    }
  }, [preChatEnabled]);

  React.useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleReset = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setMessages(INITIAL_MESSAGES);
    setInputText('');
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormError(null);
    setIsAgentTyping(false);
    setActiveTab(preChatEnabled ? 'prechat' : 'messages');
    setIsOpen(true);
  };

  const handlePreChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const showName = preChatRequireName || (!preChatRequireEmail && !preChatRequirePhone);
    if (showName && !formName.trim()) {
      setFormError('Vui lòng nhập Họ và tên');
      return;
    }
    if (preChatRequirePhone && (!formPhone.trim() || formPhone.trim().length < 8)) {
      setFormError('Vui lòng nhập Số điện thoại hợp lệ');
      return;
    }
    if (preChatRequireEmail && (!formEmail.trim() || !formEmail.includes('@'))) {
      setFormError('Vui lòng nhập Địa chỉ Email hợp lệ');
      return;
    }

    setActiveTab('messages');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    const userMsg: TestMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      time: timeStr,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsAgentTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsAgentTyping(false);
      const agentReply: TestMessage = {
        id: `agent_${Date.now()}`,
        sender: 'agent',
        text: 'Cảm ơn bạn đã liên hệ! Sales Copilot đã ghi nhận yêu cầu của bạn.',
        time: timeStr,
      };
      setMessages(prev => [...prev, agentReply]);
    }, 1000);
  };

  const showNameField = preChatRequireName || (!preChatRequireEmail && !preChatRequirePhone);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card/60 shadow-xs overflow-hidden">
      {/* Simulator Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('desktop')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === 'desktop'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Xem giao diện Desktop"
            >
              <Monitor className="size-3.5" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mobile')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === 'mobile'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Xem giao diện Mobile"
            >
              <Smartphone className="size-3.5" />
              <span>Mobile</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('script')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === 'script'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Mã nhúng Website Live Chat"
            >
              <Code2 className="size-3.5" />
              <span>Script</span>
            </button>
          </div>

          {viewMode !== 'script' && preChatEnabled && (
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('prechat')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  activeTab === 'prechat'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pre-chat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('messages')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  activeTab === 'messages'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Tin nhắn
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'script' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyEmbedScript}
              className="h-7 px-2.5 text-xs font-medium gap-1 text-foreground"
              title="Sao chép mã nhúng script"
            >
              {isCopied ? (
                <>
                  <Check className="size-3 text-emerald-500" />
                  <span>Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Sao chép mã</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              title="Đặt lại bản xem trước"
            >
              <RotateCcw className="size-3" />
              <span className="hidden sm:inline">Đặt lại</span>
            </Button>
          )}
        </div>
      </div>

      {/* Simulator / Script Canvas */}
      <div
        className={`relative flex items-center justify-center p-4 transition-all duration-300 ${
          viewMode === 'desktop'
            ? 'min-h-[540px] bg-slate-900/5 dark:bg-slate-950/40'
            : viewMode === 'mobile'
              ? 'min-h-[580px] bg-slate-900/10 dark:bg-slate-950/60'
              : 'min-h-[540px] bg-background items-stretch p-4'
        }`}
      >
        {/* DESKTOP VIEW MOCKUP */}
        {viewMode === 'desktop' && (
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
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="size-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white"
                      title="Đóng chat"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {/* Widget Body: Pre-chat vs Messages */}
                  <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-900/60">
                    {preChatEnabled && activeTab === 'prechat' ? (
                      <form
                        onSubmit={handlePreChatSubmit}
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
                                onChange={e => setFormName(e.target.value)}
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
                                onChange={e => setFormPhone(e.target.value)}
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
                                onChange={e => setFormEmail(e.target.value)}
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
                          <MessageScroller
                            autoScroll
                            defaultScrollPosition="end"
                            className="h-full"
                          >
                            <MessageScrollerViewport className="p-3">
                              <MessageScrollerContent className="gap-2.5">
                                <MessageScrollerItem className="min-w-0">
                                  <div className="rounded-lg bg-card border border-border/80 p-2 text-[11px] text-muted-foreground shadow-2xs leading-relaxed">
                                    👋 Chào mừng bạn đến với cửa hàng! Hãy để lại tin nhắn nếu bạn
                                    cần trợ giúp.
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
                          onSubmit={handleSendMessage}
                          className="p-2 border-t border-border bg-background flex items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder="Gõ tin nhắn thử nghiệm..."
                            className="flex-1 h-7 rounded border border-border px-2 text-[11px] bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="size-7 rounded flex items-center justify-center text-white disabled:opacity-40 transition-opacity shrink-0"
                            style={{ backgroundColor: widgetColor }}
                          >
                            <Send className="size-3" />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Launcher Bubble on bottom-right */}
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="absolute bottom-4 right-4 size-11 rounded-full text-white shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
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
              </button>
            </div>
          </div>
        )}

        {/* MOBILE VIEW MOCKUP */}
        {viewMode === 'mobile' && (
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
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="size-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-900/60">
                    {preChatEnabled && activeTab === 'prechat' ? (
                      <form
                        onSubmit={handlePreChatSubmit}
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
                                onChange={e => setFormName(e.target.value)}
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
                                onChange={e => setFormPhone(e.target.value)}
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
                                onChange={e => setFormEmail(e.target.value)}
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
                          <MessageScroller
                            autoScroll
                            defaultScrollPosition="end"
                            className="h-full"
                          >
                            <MessageScrollerViewport className="p-2.5">
                              <MessageScrollerContent className="gap-2">
                                <MessageScrollerItem className="min-w-0">
                                  <div className="rounded-lg bg-card border border-border/80 p-2 text-[10px] text-muted-foreground shadow-2xs leading-relaxed">
                                    👋 Chào mừng bạn đến với cửa hàng! Hãy để lại tin nhắn nếu bạn
                                    cần trợ giúp.
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
                          onSubmit={handleSendMessage}
                          className="px-1.5 pb-3 pt-2 border-t border-border bg-background flex items-center gap-1"
                        >
                          <input
                            type="text"
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder="Gõ tin nhắn..."
                            className="flex-1 h-7 rounded border border-border px-2 text-[11px] bg-background text-foreground outline-none"
                          />
                          <button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="size-7 rounded flex items-center justify-center text-white disabled:opacity-40 shrink-0"
                            style={{ backgroundColor: widgetColor }}
                          >
                            <Send className="size-3" />
                          </button>
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
                    <button
                      type="button"
                      onClick={() => setIsOpen(true)}
                      className="size-12 rounded-full text-white shadow-xl flex items-center justify-center"
                      style={{ backgroundColor: widgetColor }}
                    >
                      <MessageSquare className="size-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCRIPT EMBED VIEW */}
        {viewMode === 'script' && (
          <div className="w-full flex flex-col justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <FileCode className="size-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-foreground">
                      Mã nhúng Website Live Chat
                    </span>
                  </div>
                </div>
              </div>

              {/* Code Box */}
              <div className="rounded-lg border border-border/80 bg-slate-950 dark:bg-zinc-950 overflow-hidden shadow-xs flex flex-col">
                <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-3 py-1.5 text-[10px] text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-red-400/80" />
                    <div className="size-2 rounded-full bg-amber-400/80" />
                    <div className="size-2 rounded-full bg-emerald-400/80" />
                    <span className="ml-1 text-slate-300">index.html</span>
                  </div>
                  <span>HTML &bull; UTF-8</span>
                </div>
                <pre className="p-3.5 text-[11px] font-mono text-slate-200 leading-relaxed overflow-x-auto whitespace-pre select-all max-h-[360px]">
                  {embedScript}
                </pre>
              </div>
            </div>

            {/* Quick 3-Step Integration Guide */}
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-foreground">
                Hướng dẫn tích hợp nhanh:
              </span>
              <ol className="text-[11px] text-muted-foreground space-y-1.5 pl-4 list-decimal leading-relaxed">
                <li>Sao chép toàn bộ đoạn mã script phía trên.</li>
                <li>
                  Dán vào mã nguồn website (HTML, WordPress, Webflow, Shopify...) ngay trước thẻ{' '}
                  <code className="font-mono text-foreground font-semibold">&lt;/body&gt;</code>.
                </li>
                <li>
                  Tải lại trang web để kiểm tra biểu tượng chat xuất hiện ở góc dưới bên phải màn
                  hình.
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-border bg-muted/20 px-3.5 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3 text-primary" />
          {viewMode === 'script'
            ? 'Hỗ trợ nhúng vào mọi nền tảng website'
            : 'Mô phỏng tức thì theo cấu hình bên cạnh'}
        </span>
        <Badge variant="outline" className="text-[10px] h-5 font-mono">
          {viewMode === 'script' ? 'JavaScript SDK' : widgetColor}
        </Badge>
      </div>
    </div>
  );
}
