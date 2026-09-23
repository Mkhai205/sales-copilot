'use client';

import * as React from 'react';
import type { KnowledgeArticleDto } from '@sales-copilot/shared-contracts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { useDeleteKnowledgeArticle } from '../../hooks/use-knowledge';

interface KnowledgeDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  article: KnowledgeArticleDto | null;
  onDeleted?: () => void;
}

export function KnowledgeDeleteDialog({
  open,
  onOpenChange,
  workspaceId,
  article,
  onDeleted,
}: KnowledgeDeleteDialogProps) {
  const { mutate: deleteArticle, isPending } = useDeleteKnowledgeArticle(workspaceId);

  const handleDelete = () => {
    if (!article) return;
    deleteArticle(article.id, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa bài viết kiến thức?</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc chắn muốn xóa bài viết{' '}
            <strong className="text-foreground">"{article?.title}"</strong>? Hành động này sẽ xóa
            vĩnh viễn dữ liệu bài viết và vector embedding khỏi hệ thống. AI Chatbot sẽ không thể
            tra cứu nội dung này nữa.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={e => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Spinner className="mr-2 h-4 w-4" />}
            Xóa bài viết
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
