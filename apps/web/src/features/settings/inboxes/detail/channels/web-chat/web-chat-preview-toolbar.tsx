'use client';

import { Check, Code2, Copy, Monitor, RotateCcw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WebChatPreviewToolbarProps {
  viewMode: 'desktop' | 'mobile' | 'script';
  onViewModeChange: (mode: 'desktop' | 'mobile' | 'script') => void;
  preChatEnabled: boolean;
  activeTab: 'prechat' | 'messages';
  onActiveTabChange: (tab: 'prechat' | 'messages') => void;
  isCopied: boolean;
  onCopyEmbedScript: () => void;
  onReset: () => void;
}

export function WebChatPreviewToolbar({
  viewMode,
  onViewModeChange,
  preChatEnabled,
  activeTab,
  onActiveTabChange,
  isCopied,
  onCopyEmbedScript,
  onReset,
}: WebChatPreviewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
          <Button
            type="button"
            variant="ghost"
            className={`h-auto w-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === 'desktop'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onViewModeChange('desktop')}
            title="Xem giao diện Desktop"
          >
            <Monitor className="size-3.5" />
            <span>Desktop</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={`h-auto w-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === 'mobile'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onViewModeChange('mobile')}
            title="Xem giao diện Mobile"
          >
            <Smartphone className="size-3.5" />
            <span>Mobile</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={`h-auto w-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === 'script'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onViewModeChange('script')}
            title="Mã nhúng Website Live Chat"
          >
            <Code2 className="size-3.5" />
            <span>Script</span>
          </Button>
        </div>

        {viewMode !== 'script' && preChatEnabled && (
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-xs">
            <Button
              type="button"
              variant="ghost"
              className={`h-auto w-auto px-2 py-0.5 rounded font-medium transition-colors ${
                activeTab === 'prechat'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onActiveTabChange('prechat')}
            >
              Pre-chat
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={`h-auto w-auto px-2 py-0.5 rounded font-medium transition-colors ${
                activeTab === 'messages'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onActiveTabChange('messages')}
            >
              Tin nhắn
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {viewMode === 'script' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopyEmbedScript}
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
            onClick={onReset}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            title="Đặt lại bản xem trước"
          >
            <RotateCcw className="size-3" />
            <span className="hidden sm:inline">Đặt lại</span>
          </Button>
        )}
      </div>
    </div>
  );
}
