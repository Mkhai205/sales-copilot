'use client';

import * as React from 'react';
import { TrendingUp, UserPlus, Sparkles, FileSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { BuyingSignalType, LeadStage, LeadStatus } from '@sales-copilot/shared-contracts';
import {
  useContactLead,
  useConversationEvidence,
  useCreateLead,
} from '../hooks/use-sales-intelligence';
import { LeadScoreCard } from './lead-score-card';
import { BantMatrix } from './bant-matrix';
import { EvidenceItemCard } from './evidence-item-card';

interface SalesEvidenceTabProps {
  workspaceId: string;
  conversationId: string;
  contactId: string;
}

export function SalesEvidenceTab({
  workspaceId,
  conversationId,
  contactId,
}: SalesEvidenceTabProps) {
  const [filter, setFilter] = React.useState<'all' | 'bant' | 'risk'>('all');

  const { data: lead, isLoading: isLeadLoading } = useContactLead(workspaceId, contactId);
  const { data: evidences = [], isLoading: isEvidenceLoading } = useConversationEvidence(
    workspaceId,
    conversationId,
  );
  const { mutate: createLead, isPending: isCreatingLead } = useCreateLead(workspaceId, contactId);

  const isBantSignal = (type: BuyingSignalType) =>
    [
      BuyingSignalType.BUDGET_CONFIRMED,
      BuyingSignalType.AUTHORITY_IDENTIFIED,
      BuyingSignalType.NEED_EXPRESSED,
      BuyingSignalType.TIMELINE_DEFINED,
    ].includes(type);

  const isRiskSignal = (type: BuyingSignalType) =>
    [
      BuyingSignalType.OBJECTION_RAISED,
      BuyingSignalType.COMPETITOR_MENTION,
      BuyingSignalType.CHURN_RISK,
    ].includes(type);

  const filteredEvidences = React.useMemo(() => {
    return (evidences || []).filter(e => {
      if (!e) return false;
      if (filter === 'bant') {
        return e.signalCategory === 'BANT' || isBantSignal(e.signalType);
      }
      if (filter === 'risk') {
        return isRiskSignal(e.signalType);
      }
      return true;
    });
  }, [evidences, filter]);

  if (isLeadLoading && isEvidenceLoading) {
    return (
      <div className="flex flex-col gap-3 p-1">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Lead Score Overview or Create Lead Callout */}
      {lead ? (
        <LeadScoreCard lead={lead} workspaceId={workspaceId} />
      ) : (
        <Card className="p-3 border-dashed border-primary/30 bg-primary/5 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <UserPlus className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">
                Chưa khởi tạo hồ sơ Lead
              </span>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                Khởi tạo Lead để bắt đầu chấm điểm tiềm năng (AI Scoring) và quản lý cơ hội bán
                hàng.
              </p>
            </div>
          </div>
          <Button
            size="xs"
            className="self-start gap-1 text-xs"
            onClick={() =>
              createLead({
                status: LeadStatus.NEW,
                stage: LeadStage.DISCOVERY,
              })
            }
            disabled={isCreatingLead}
          >
            <TrendingUp className="size-3" />
            <span>{isCreatingLead ? 'Đang tạo Lead...' : 'Tạo Lead cho khách hàng'}</span>
          </Button>
        </Card>
      )}

      {/* 2. Sổ cái tiêu chuẩn BANT (4 Quadrants) */}
      <BantMatrix evidences={evidences} />

      <Separator className="bg-border/60" />

      {/* 3. Sổ cái bằng chứng bán hàng (Sales Evidence Ledger Timeline) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Sổ cái bằng chứng AI</span>
            {evidences.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
                {evidences.length}
              </Badge>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-md text-[10px]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-1.5 py-0.5 rounded ${
                filter === 'all'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setFilter('bant')}
              className={`px-1.5 py-0.5 rounded ${
                filter === 'bant'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              BANT
            </button>
            <button
              type="button"
              onClick={() => setFilter('risk')}
              className={`px-1.5 py-0.5 rounded ${
                filter === 'risk'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Rủi ro
            </button>
          </div>
        </div>

        {/* Evidence List or Empty State */}
        {filteredEvidences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 text-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-4">
            <FileSearch className="size-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-medium text-foreground">Chưa có bằng chứng phù hợp</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[220px]">
              {filter === 'all'
                ? 'AI Copilot sẽ tự động trích xuất tín hiệu BANT và mua hàng khi khách hàng gửi tin nhắn.'
                : filter === 'bant'
                  ? 'Chưa phát hiện tín hiệu BANT nào trong bộ lọc này.'
                  : 'Không có rủi ro hoặc phản đối nào được ghi nhận.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredEvidences.map(ev => (
              <EvidenceItemCard
                key={ev.id}
                evidence={ev}
                workspaceId={workspaceId}
                conversationId={conversationId}
                leadId={lead?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
