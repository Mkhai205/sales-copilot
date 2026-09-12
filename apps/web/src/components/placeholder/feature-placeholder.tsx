import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Sparkles } from 'lucide-react';

export interface FeatureItem {
  title: string;
  description: string;
  status: 'ready' | 'in_progress' | 'planned';
}

export interface FeaturePlaceholderProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  milestone?: string;
  features: FeatureItem[];
  actionLabel?: string;
  onAction?: () => void;
}

export function FeaturePlaceholder({
  title,
  subtitle,
  icon: Icon,
  milestone = 'Phase 2 (D2C Conversational Commerce)',
  features,
  actionLabel,
  onAction,
}: FeaturePlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-muted/20 p-6 md:p-8">
      {/* Header section */}
      <div className="flex flex-col gap-3 pb-6 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 shadow-xs">
            <Icon className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
              <Badge
                variant="outline"
                className="text-xs font-normal border-primary/30 text-primary bg-primary/5"
              >
                {milestone}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>

        {actionLabel && (
          <Button onClick={onAction} className="shrink-0 gap-2 shadow-xs">
            <Sparkles className="size-4" />
            <span>{actionLabel}</span>
          </Button>
        )}
      </div>

      {/* Main content showcase */}
      <div className="mt-8 flex flex-col gap-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, idx) => (
            <Card
              key={idx}
              className="bg-card shadow-xs transition-colors hover:border-foreground/20"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{feature.title}</CardTitle>
                  {feature.status === 'ready' && (
                    <Badge
                      variant="outline"
                      className="text-xs text-emerald-600 bg-emerald-500/10 border-emerald-500/20 gap-1"
                    >
                      <CheckCircle2 className="size-3" />
                      Đã sẵn sàng
                    </Badge>
                  )}
                  {feature.status === 'in_progress' && (
                    <Badge
                      variant="outline"
                      className="text-xs text-amber-600 bg-amber-500/10 border-amber-500/20 gap-1"
                    >
                      <Clock className="size-3" />
                      Đang hoàn thiện
                    </Badge>
                  )}
                  {feature.status === 'planned' && (
                    <Badge variant="secondary" className="text-xs text-muted-foreground">
                      Kế hoạch
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-1 text-muted-foreground/90">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Integration tip banner */}
        <div className="rounded-lg border border-border/80 bg-background/80 p-4 shadow-xs backdrop-blur-xs flex items-start gap-3">
          <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Kết nối đa kênh thời gian thực:</span>{' '}
            Dữ liệu trên module này được đồng bộ tức thì với các hội thoại bán hàng qua Socket.io và
            cơ chế khóa chống bán âm kho (Atomic Reservation).
          </div>
        </div>
      </div>
    </div>
  );
}
