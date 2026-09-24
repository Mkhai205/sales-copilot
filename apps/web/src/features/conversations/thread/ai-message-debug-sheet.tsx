'use client';

import * as React from 'react';
import {
  Bot,
  Clock,
  Coins,
  Cpu,
  Layers,
  Search,
  PackageCheck,
  FileText,
  QrCode,
  MapPin,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import type { AiDebugMetadata, AiToolCallDebug } from '@sales-copilot/shared-contracts';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface AiMessageDebugSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiDebug?: AiDebugMetadata | null;
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'searchProducts':
    case 'getProductDetails':
      return <Search className="size-3.5 text-blue-500" />;
    case 'checkInventory':
      return <PackageCheck className="size-3.5 text-emerald-500" />;
    case 'createDraftOrder':
      return <FileText className="size-3.5 text-indigo-500" />;
    case 'confirmAndGenerateQR':
      return <QrCode className="size-3.5 text-amber-500" />;
    case 'extractShippingInfo':
      return <MapPin className="size-3.5 text-rose-500" />;
    case 'updateContactInfo':
      return <UserCheck className="size-3.5 text-teal-500" />;
    case 'evaluateDiscount':
      return <Coins className="size-3.5 text-purple-500" />;
    case 'escalateToHuman':
      return <AlertCircle className="size-3.5 text-amber-600" />;
    default:
      return <Cpu className="size-3.5 text-primary" />;
  }
}

export function AiMessageDebugSheet({ open, onOpenChange, aiDebug }: AiMessageDebugSheetProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!aiDebug) return;
    navigator.clipboard.writeText(JSON.stringify(aiDebug, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!aiDebug) return null;

  const {
    provider,
    model,
    stepsCount,
    totalDurationMs,
    usage,
    estimatedCostUsd,
    toolCalls = [],
  } = aiDebug;

  const durationSec = (totalDurationMs / 1000).toFixed(2);
  const costFormatted =
    estimatedCostUsd < 0.001 && estimatedCostUsd > 0
      ? `$${estimatedCostUsd.toFixed(6)}`
      : `$${estimatedCostUsd.toFixed(4)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-background">
        {/* Header */}
        <SheetHeader className="p-4 pb-3 border-b border-border/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold text-foreground">
                  Chi tiết xử lý AI
                </SheetTitle>
                <SheetDescription className="text-[11px] text-muted-foreground">
                  Giám sát suy luận, chi phí và các bước gọi công cụ
                </SheetDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={handleCopy}
              className="size-7"
              title="Copy raw JSON"
            >
              {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            </Button>
          </div>
        </SheetHeader>

        {/* Content Body */}
        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-4">
            {/* Top Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-medium">
                  <Bot className="size-3 text-primary" />
                  <span>Mô hình & Provider</span>
                </div>
                <div className="text-xs font-semibold text-foreground truncate" title={model}>
                  {model}
                </div>
                <div className="text-[10px] text-muted-foreground capitalize">
                  {provider.replace('-', ' ')}
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-medium">
                  <Coins className="size-3 text-amber-500" />
                  <span>Chi phí ước tính</span>
                </div>
                <div className="text-xs font-semibold text-foreground">{costFormatted}</div>
                <div className="text-[10px] text-muted-foreground">
                  ${(estimatedCostUsd * 25400).toFixed(1)} VND
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-medium">
                  <Clock className="size-3 text-blue-500" />
                  <span>Thời gian thực thi</span>
                </div>
                <div className="text-xs font-semibold text-foreground">{durationSec}s</div>
                <div className="text-[10px] text-muted-foreground">{totalDurationMs} ms</div>
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-medium">
                  <Layers className="size-3 text-indigo-500" />
                  <span>Token tiêu thụ</span>
                </div>
                <div className="text-xs font-semibold text-foreground">
                  {usage.total.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {usage.input.toLocaleString()} in / {usage.output.toLocaleString()} out
                </div>
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* Steps & Tool Calls Timeline */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Cpu className="size-3.5 text-primary" />
                  <span>Các bước xử lý ({stepsCount} bước)</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {toolCalls.length} lần gọi công cụ
                </Badge>
              </div>

              {toolCalls.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground bg-muted/10">
                  <CheckCircle2 className="size-5 text-emerald-500 mx-auto mb-1.5" />
                  <span>Sinh văn bản trực tiếp mà không cần gọi công cụ ngoài.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {toolCalls.map((tc: AiToolCallDebug, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border/80 bg-card p-3 flex flex-col gap-2 shadow-xs"
                    >
                      {/* Tool Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {getToolIcon(tc.name)}
                          <span className="font-semibold text-xs text-foreground truncate">
                            {tc.name}
                          </span>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono shrink-0 py-0 px-1.5"
                        >
                          <Clock className="size-2.5 mr-1 inline" />
                          {tc.durationMs}ms
                        </Badge>
                      </div>

                      {/* Input Arguments */}
                      {tc.input && Object.keys(tc.input).length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            Tham số đầu vào:
                          </span>
                          <pre className="text-[11px] font-mono bg-muted/40 p-2 rounded border border-border/50 overflow-x-auto whitespace-pre-wrap max-h-24">
                            {JSON.stringify(tc.input, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Output Summary */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">
                          Kết quả tóm tắt:
                        </span>
                        <div className="text-[11px] text-foreground bg-primary/5 p-2 rounded border border-primary/20 leading-relaxed">
                          {tc.outputSummary}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
