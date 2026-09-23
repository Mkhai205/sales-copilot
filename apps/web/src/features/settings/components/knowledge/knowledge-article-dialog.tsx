'use client';

import * as React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import type { KnowledgeArticleDto } from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useCreateKnowledgeArticle, useUpdateKnowledgeArticle } from '../../hooks/use-knowledge';

export const KNOWLEDGE_CATEGORY_LABELS: Record<string, string> = {
  policy: 'Chính sách cửa hàng',
  faq: 'Câu hỏi thường gặp (FAQ)',
  shipping: 'Vận chuyển & Giao hàng',
  warranty: 'Bảo hành & Đổi trả',
  promotion: 'Khuyến mãi & Ưu đãi',
  other: 'Khác',
};

interface KnowledgeArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  articleToEdit?: KnowledgeArticleDto | null;
  onSaved?: () => void;
}

export function KnowledgeArticleDialog({
  open,
  onOpenChange,
  workspaceId,
  articleToEdit,
  onSaved,
}: KnowledgeArticleDialogProps) {
  const isEditing = !!articleToEdit;

  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [category, setCategory] = React.useState<string>('policy');
  const [isActive, setIsActive] = React.useState(true);
  const [touched, setTouched] = React.useState(false);

  const { mutate: createArticle, isPending: isCreating } = useCreateKnowledgeArticle(workspaceId);
  const { mutate: updateArticle, isPending: isUpdating } = useUpdateKnowledgeArticle(workspaceId);

  const isPending = isCreating || isUpdating;

  React.useEffect(() => {
    if (open) {
      if (articleToEdit) {
        setTitle(articleToEdit.title);
        setContent(articleToEdit.content);
        setCategory(articleToEdit.category || 'policy');
        setIsActive(articleToEdit.isActive);
      } else {
        setTitle('');
        setContent('');
        setCategory('policy');
        setIsActive(true);
      }
      setTouched(false);
    }
  }, [open, articleToEdit]);

  const titleError = touched && !title.trim() ? 'Tiêu đề không được để trống' : '';
  const contentError = touched && !content.trim() ? 'Nội dung không được để trống' : '';
  const isFormValid = title.trim().length > 0 && content.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!isFormValid || isPending) return;

    if (isEditing && articleToEdit) {
      updateArticle(
        {
          id: articleToEdit.id,
          dto: {
            title: title.trim(),
            content: content.trim(),
            category,
            isActive,
          },
        },
        {
          onSuccess: () => {
            onOpenChange(false);
            onSaved?.();
          },
        },
      );
    } else {
      createArticle(
        {
          title: title.trim(),
          content: content.trim(),
          category,
          isActive,
        },
        {
          onSuccess: () => {
            onOpenChange(false);
            onSaved?.();
          },
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>
                  {isEditing ? 'Chỉnh sửa bài viết kiến thức' : 'Thêm bài viết kiến thức mới'}
                </DialogTitle>
                <DialogDescription>
                  Bài viết sẽ được AI Chatbot tự động vector hóa để tra cứu trả lời khách hàng.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="article-title" className="text-sm font-medium">
                Tiêu đề bài viết <span className="text-destructive">*</span>
              </Label>
              <Input
                id="article-title"
                placeholder="Ví dụ: Chính sách đổi trả hàng trong 7 ngày"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={255}
                disabled={isPending}
              />
              {titleError && <p className="text-xs text-destructive">{titleError}</p>}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="article-category" className="text-sm font-medium">
                Danh mục phân loại
              </Label>
              <Select value={category} onValueChange={val => setCategory(val)} disabled={isPending}>
                <SelectTrigger id="article-category">
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KNOWLEDGE_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="article-content" className="text-sm font-medium">
                  Nội dung chi tiết <span className="text-destructive">*</span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  {content.length} / 10,000 ký tự
                </span>
              </div>
              <Textarea
                id="article-content"
                rows={7}
                placeholder="Nhập nội dung quy định, chính sách hoặc thông tin chi tiết mà khách hàng thường hỏi..."
                value={content}
                onChange={e => setContent(e.target.value)}
                maxLength={10000}
                disabled={isPending}
                className="resize-y text-sm leading-relaxed"
              />
              {contentError && <p className="text-xs text-destructive">{contentError}</p>}
            </div>

            {/* IsActive Switch */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="article-active" className="text-sm font-medium cursor-pointer">
                  Kích hoạt cho AI tra cứu
                </Label>
                <span className="text-xs text-muted-foreground">
                  Khi tắt, AI Chatbot sẽ tạm thời bỏ qua bài viết này khi tìm kiếm câu trả lời.
                </span>
              </div>
              <Switch
                id="article-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isPending}
              />
            </div>

            {/* AI Vector Hint */}
            <div className="flex items-center gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>
                Hệ thống sử dụng Gemini <strong>text-embedding-004</strong> để sinh vector 768
                chiều.
                {isEditing
                  ? ' Lưu lại sẽ tự động re-index vector.'
                  : ' Sau khi tạo, trạng thái sẽ tự động chuyển sang READY.'}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isPending || (touched && !isFormValid)}>
              {isPending && <Spinner className="mr-2 h-4 w-4" />}
              {isEditing ? 'Cập nhật bài viết' : 'Lưu bài viết'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
