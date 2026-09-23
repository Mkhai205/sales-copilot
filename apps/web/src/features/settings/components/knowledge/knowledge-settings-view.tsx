'use client';

import * as React from 'react';
import { BookOpen, Plus, Sparkles } from 'lucide-react';
import type { KnowledgeArticleDto } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsGuard } from '../settings-guard';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';
import { useKnowledgeArticles } from '../../hooks/use-knowledge';
import { KnowledgeArticleTable } from './knowledge-article-table';
import { KnowledgeArticleDialog } from './knowledge-article-dialog';
import { KnowledgeTestSearchDialog } from './knowledge-test-search-dialog';
import { KnowledgeDeleteDialog } from './knowledge-delete-dialog';

export interface KnowledgeSettingsViewProps {
  workspaceSlug: string;
}

export function KnowledgeSettingsView({ workspaceSlug }: KnowledgeSettingsViewProps) {
  const { currentWorkspace, isLoading: isRbacLoading } = useSettingsRbac(workspaceSlug);
  const workspaceId = currentWorkspace?.id;

  const { data: articlesData } = useKnowledgeArticles(workspaceId, { limit: 1 });
  const totalArticles = articlesData?.meta?.total ?? 0;

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [articleToEdit, setArticleToEdit] = React.useState<KnowledgeArticleDto | null>(null);
  const [articleToDelete, setArticleToDelete] = React.useState<KnowledgeArticleDto | null>(null);
  const [isTestSearchOpen, setIsTestSearchOpen] = React.useState(false);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="knowledge">
      <div className="flex flex-col gap-6 w-full p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader
            title="Kiến thức AI"
            description="Quản lý chính sách, FAQ và thông tin cửa hàng. AI Chatbot tự động tra cứu ngữ nghĩa bằng pgvector."
            icon={BookOpen}
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {workspaceId && (
              <Badge
                variant="outline"
                className="hidden sm:inline-flex text-xs py-1 px-2.5 font-normal"
              >
                {totalArticles} / 500 bài viết
              </Badge>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTestSearchOpen(true)}
              className="gap-2"
              disabled={isRbacLoading || !workspaceId}
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Thử nghiệm tìm kiếm
            </Button>

            <Button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="gap-2"
              disabled={isRbacLoading || !workspaceId}
            >
              <Plus className="h-4 w-4" />
              Thêm bài viết
            </Button>
          </div>
        </div>

        {/* Content Area */}
        {isRbacLoading || !workspaceId ? (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-9 w-72 rounded-md" />
              <Skeleton className="h-9 w-40 rounded-md" />
            </div>
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        ) : (
          <KnowledgeArticleTable
            workspaceId={workspaceId}
            onEditArticle={article => setArticleToEdit(article)}
            onDeleteArticle={article => setArticleToDelete(article)}
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenTestSearch={() => setIsTestSearchOpen(true)}
          />
        )}

        {/* Create / Edit Dialog */}
        {workspaceId && (
          <KnowledgeArticleDialog
            open={isCreateOpen || !!articleToEdit}
            onOpenChange={open => {
              if (!open) {
                setIsCreateOpen(false);
                setArticleToEdit(null);
              }
            }}
            workspaceId={workspaceId}
            articleToEdit={articleToEdit}
          />
        )}

        {/* Test Search Dialog */}
        {workspaceId && (
          <KnowledgeTestSearchDialog
            open={isTestSearchOpen}
            onOpenChange={setIsTestSearchOpen}
            workspaceId={workspaceId}
          />
        )}

        {/* Delete Confirmation Dialog */}
        {workspaceId && (
          <KnowledgeDeleteDialog
            open={!!articleToDelete}
            onOpenChange={open => {
              if (!open) setArticleToDelete(null);
            }}
            workspaceId={workspaceId}
            article={articleToDelete}
          />
        )}
      </div>
    </SettingsGuard>
  );
}
