'use client';

import * as React from 'react';
import { FileCode, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { WebChatPreviewToolbar } from './web-chat-preview-toolbar';
import { WebChatPreviewDesktop } from './web-chat-preview-desktop';
import { WebChatPreviewMobile } from './web-chat-preview-mobile';

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

export interface TestMessage {
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

export interface WebChatPreviewSimulatorProps {
  widgetColor: string;
  inboxTitle: string;
  tagline: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: 'prechat' | 'messages';
  preChatEnabled: boolean;
  preChatRequirePhone: boolean;
  preChatRequireEmail: boolean;
  showNameField: boolean;
  formError: string | null;
  formName: string;
  onFormNameChange: (value: string) => void;
  formPhone: string;
  onFormPhoneChange: (value: string) => void;
  formEmail: string;
  onFormEmailChange: (value: string) => void;
  onPreChatSubmit: (e: React.FormEvent) => void;
  messages: TestMessage[];
  isAgentTyping: boolean;
  inputText: string;
  onInputTextChange: (value: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
}

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
      <WebChatPreviewToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        preChatEnabled={preChatEnabled}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        isCopied={isCopied}
        onCopyEmbedScript={handleCopyEmbedScript}
        onReset={handleReset}
      />

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
          <WebChatPreviewDesktop
            widgetColor={widgetColor}
            inboxTitle={inboxTitle}
            tagline={tagline}
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            activeTab={activeTab}
            preChatEnabled={preChatEnabled}
            preChatRequirePhone={preChatRequirePhone}
            preChatRequireEmail={preChatRequireEmail}
            showNameField={showNameField}
            formError={formError}
            formName={formName}
            onFormNameChange={setFormName}
            formPhone={formPhone}
            onFormPhoneChange={setFormPhone}
            formEmail={formEmail}
            onFormEmailChange={setFormEmail}
            onPreChatSubmit={handlePreChatSubmit}
            messages={messages}
            isAgentTyping={isAgentTyping}
            inputText={inputText}
            onInputTextChange={setInputText}
            onSendMessage={handleSendMessage}
          />
        )}

        {/* MOBILE VIEW MOCKUP */}
        {viewMode === 'mobile' && (
          <WebChatPreviewMobile
            widgetColor={widgetColor}
            inboxTitle={inboxTitle}
            tagline={tagline}
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            activeTab={activeTab}
            preChatEnabled={preChatEnabled}
            preChatRequirePhone={preChatRequirePhone}
            preChatRequireEmail={preChatRequireEmail}
            showNameField={showNameField}
            formError={formError}
            formName={formName}
            onFormNameChange={setFormName}
            formPhone={formPhone}
            onFormPhoneChange={setFormPhone}
            formEmail={formEmail}
            onFormEmailChange={setFormEmail}
            onPreChatSubmit={handlePreChatSubmit}
            messages={messages}
            isAgentTyping={isAgentTyping}
            inputText={inputText}
            onInputTextChange={setInputText}
            onSendMessage={handleSendMessage}
          />
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
