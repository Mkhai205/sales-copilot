'use client';

import * as React from 'react';
import {
  Flame,
  Zap,
  Snowflake,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  History,
  Briefcase,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LeadGrade, type LeadResponseDto } from '@sales-copilot/shared-contracts';
import { ConvertOpportunityDialog } from '@/features/copilot/components/convert-opportunity-dialog';
import {
  useLeadScore,
  useLeadScoreHistory,
  useRecalculateScore,
} from '../hooks/use-sales-intelligence';

interface LeadScoreCardProps {
  lead: LeadResponseDto;
  workspaceId: string;
}

export function LeadScoreCard({ lead, workspaceId }: LeadScoreCardProps) {
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = React.useState(false);

  const { data: scoreData } = useLeadScore(workspaceId, lead.id);
  const { data: historyItems = [], isLoading: isHistoryLoading } = useLeadScoreHistory(
    workspaceId,
    lead.id,
  );
  const { mutate: recalculate, isPending: isRecalculating } = useRecalculateScore(
    workspaceId,
    lead.id,
  );

  const currentScore = scoreData?.score ?? lead.score ?? 0;
  const currentGrade = scoreData?.grade ?? lead.grade ?? LeadGrade.COLD;
  const factors = scoreData?.scoreFactors;

  const renderGradeBadge = (grade: LeadGrade) => {
    switch (grade) {
      case LeadGrade.HOT:
        return (
          <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 gap-1 text-[11px] font-semibold">
            <Flame className="size-3" />
            <span>HOT LEAD</span>
          </Badge>
        );
      case LeadGrade.WARM:
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px] font-semibold">
            <Zap className="size-3" />
            <span>WARM LEAD</span>
          </Badge>
        );
      case LeadGrade.COLD:
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 text-[11px] font-semibold">
            <Snowflake className="size-3" />
            <span>COLD LEAD</span>
          </Badge>
        );
      case LeadGrade.JUNK:
      default:
        return (
          <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground">
            <AlertTriangle className="size-3" />
            <span>JUNK</span>
          </Badge>
        );
    }
  };

  return (
    <>
      <Card className="p-3 border-border/70 bg-card">
        {/* Top bar: Grade & Score & Recalculate */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {renderGradeBadge(currentGrade)}
            <Badge variant="secondary" className="text-[10px]">
              {lead.status}
            </Badge>
            {lead.stage && (
              <Badge variant="outline" className="text-[10px]">
                {lead.stage}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => recalculate()}
              disabled={isRecalculating}
              className="size-6 text-muted-foreground hover:text-foreground"
              title="Tính lại điểm Lead"
            >
              <RefreshCw className={`size-3 ${isRecalculating ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setHistoryOpen(true)}
              className="size-6 text-muted-foreground hover:text-foreground"
              title="Lịch sử thay đổi điểm"
            >
              <History className="size-3" />
            </Button>
          </div>
        </div>

        {/* Big Score Visual */}
        <div className="mt-3 flex items-center justify-between bg-muted/30 p-2.5 rounded-lg border border-border/50">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
              Điểm Tiềm Năng (AI Lead Score)
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {currentScore}
              </span>
              <span className="text-xs text-muted-foreground font-medium">/ 100</span>
            </div>
          </div>

          {lead.status !== 'CONVERTED' ? (
            <Button
              size="xs"
              variant="outline"
              className="gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => setConvertDialogOpen(true)}
            >
              <Briefcase className="size-3" />
              <span>Chuyển Cơ hội</span>
            </Button>
          ) : (
            <Badge variant="secondary" className="text-xs text-emerald-600 dark:text-emerald-400">
              Đã chuyển Cơ hội
            </Badge>
          )}
        </div>

        {/* 3-Pillar Breakdown Progress */}
        {factors && (
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setBreakdownOpen(!breakdownOpen)}
              className="flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              <span className="text-[11px] font-semibold text-foreground">
                Phân tích 3 trụ cột (Pillars)
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                {breakdownOpen ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                {breakdownOpen ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </span>
            </button>

            {/* Pillar Gauges */}
            <div className="flex flex-col gap-1.5 text-xs">
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>Hồ sơ phù hợp (Fit)</span>
                  <span className="font-semibold text-foreground">{factors.fitScore}/25</span>
                </div>
                <Progress value={(factors.fitScore / 25) * 100} className="h-1.5" />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>Tốc độ tương tác (Velocity)</span>
                  <span className="font-semibold text-foreground">{factors.velocityScore}/25</span>
                </div>
                <Progress value={(factors.velocityScore / 25) * 100} className="h-1.5" />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>Tín hiệu mua hàng (Signals)</span>
                  <span className="font-semibold text-foreground">{factors.signalScore}/50</span>
                </div>
                <Progress value={(factors.signalScore / 50) * 100} className="h-1.5" />
              </div>

              {factors.decayPenalty > 0 && (
                <div className="flex justify-between text-[10px] text-rose-500 font-medium pt-0.5">
                  <span>Khấu trừ thời gian (Time decay):</span>
                  <span>-{factors.decayPenalty} điểm</span>
                </div>
              )}
            </div>

            {/* Detailed Factors List */}
            {breakdownOpen && factors.breakdown && factors.breakdown.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-1.5">
                {factors.breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 text-[11px] bg-muted/20 p-1.5 rounded"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{item.factor}</span>
                      {item.reason && (
                        <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                          {item.reason}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-semibold shrink-0 ${
                        item.points > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.points < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {item.points > 0 ? `+${item.points}` : item.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Convert to Opportunity Dialog */}
      <ConvertOpportunityDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        workspaceId={workspaceId}
        leadId={lead.id}
        defaultTitle={`Cơ hội - ${lead.contact?.name || 'Khách hàng'}`}
        defaultAmount={lead.estimatedValue || 12000000}
        onSuccess={() => {
          setConvertDialogOpen(false);
        }}
      />

      {/* History Audit Ledger Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Lịch sử biến động điểm Lead</DialogTitle>
            <DialogDescription>
              Sổ cái kiểm toán bất biến ghi nhận mọi lần tính toán và điều chỉnh điểm số.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-2">
            {isHistoryLoading ? (
              <p className="text-xs text-muted-foreground text-center py-6">Đang tải lịch sử...</p>
            ) : historyItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Chưa có lịch sử thay đổi điểm số.
              </p>
            ) : (
              historyItems.map(item => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 p-2 rounded-lg border border-border/60 bg-muted/20 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {item.previousScore} ➔ {item.newScore} ({item.newGrade || 'N/A'})
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        item.delta > 0
                          ? 'text-emerald-600'
                          : item.delta < 0
                            ? 'text-rose-600'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {item.delta > 0 ? `+${item.delta}` : item.delta}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{item.reason}</p>
                  <span className="text-[9px] text-muted-foreground/70">
                    Sự kiện: {item.eventTrigger} •{' '}
                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
