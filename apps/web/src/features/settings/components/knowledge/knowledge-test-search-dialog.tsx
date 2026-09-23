'use client';

import * as React from 'react';
import { Search, Sparkles, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import type { TestSearchResultDto } from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { KNOWLEDGE_CATEGORY_LABELS } from './knowledge-article-dialog';
import { useTestSearchKnowledge } from '../../hooks/use-knowledge';

interface KnowledgeTestSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function KnowledgeTestSearchDialog({
  open,
  onOpenChange,
  workspaceId,
}: KnowledgeTestSearchDialogProps) {
  const [query, setQuery] = React.useState('');
  const [minSimilarity, setMinSimilarity] = React.useState(0.65);
  const [hasSearched, setHasSearched] = React.useState(false);

  const { mutate: executeSearch, data: results, isPending } = useTestSearchKnowledge(workspaceId);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setHasSearched(false);
    }
  }, [open]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isPending) return;

    setHasSearched(true);
    executeSearch({
      query: trimmed,
      minSimilarity,
      limit: 5,
    });
  };

  const getScoreBadge = (similarity: number) => {
    const percent = Math.round(similarity * 100);
    if (percent >= 80) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {percent}% Tương đồng cao
        </Badge>
      );
    }
    if (percent >= 65) {
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          {percent}% Phù hợp (≥ 65%)
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground gap-1">
        {percent}% Dưới ngưỡng
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Thử nghiệm tìm kiếm ngữ nghĩa (pgvector)</DialogTitle>
              <DialogDescription>
                Nhập câu hỏi giả lập của khách hàng để kiểm tra độ tương đồng vector và kết quả AI
                nhận được.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="flex gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ví dụ: 'Shop có cho đổi đồ không?', 'Bao lâu thì ship tới Hà Nội?'..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={isPending}
              className="pl-9"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={isPending || !query.trim()}>
            {isPending ? <Spinner className="h-4 w-4" /> : 'Tìm kiếm'}
          </Button>
        </form>

        {/* Threshold Quick Filters */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-2">
            <span>Ngưỡng tối thiểu (minSimilarity):</span>
            {[0.5, 0.65, 0.75].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setMinSimilarity(val)}
                className={`rounded px-2 py-0.5 transition-colors ${
                  minSimilarity === val
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                {Math.round(val * 100)}% {val === 0.65 && '(Mặc định)'}
              </button>
            ))}
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[220px]">
          {isPending && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Spinner className="h-6 w-6 text-primary" />
              <p className="text-sm">Đang tính toán vector cosine similarity...</p>
            </div>
          )}

          {!isPending && hasSearched && results && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-border text-center p-6 gap-2">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <p className="text-sm font-medium text-foreground">
                Không tìm thấy bài viết nào đạt ngưỡng {Math.round(minSimilarity * 100)}%
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                Khi khách hàng hỏi câu này, AI Chatbot sẽ phản hồi rằng chưa có thông tin chính sách
                phù hợp và đề nghị chuyển sang nhân viên tư vấn hỗ trợ.
              </p>
            </div>
          )}

          {!isPending && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
              <HelpCircle className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                Nhập câu hỏi và nhấn Tìm kiếm để xem kết quả khớp ngữ nghĩa.
              </p>
            </div>
          )}

          {!isPending && results && results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>Tìm thấy {results.length} bài viết phù hợp</span>
                <span>Sắp xếp theo độ tương đồng giảm dần</span>
              </div>

              {results.map((item: TestSearchResultDto, index: number) => (
                <div
                  key={item.id || index}
                  className="rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{item.title}</span>
                      {item.category && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {KNOWLEDGE_CATEGORY_LABELS[item.category] || item.category}
                        </Badge>
                      )}
                    </div>
                    <div>{getScoreBadge(item.similarity)}</div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-line bg-muted/40 p-2.5 rounded-md font-mono">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
