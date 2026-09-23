'use client';

import * as React from 'react';
import { BookOpen, Plus, Sparkles } from 'lucide-react';
import type { KnowledgeArticleDto } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SettingsPageLayout } from '../layout';
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
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="knowledge"
      title="Kiến thức AI"
      description="Quản lý chính sách, FAQ và thông tin cửa hàng. AI Chatbot tự động tra cứu ngữ nghĩa bằng pgvector."
      icon={BookOpen}
      isLoading={isRbacLoading || !workspaceId}
      skeletonVariant="table"
      headerActions={
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
            <Sparkles className="size-4 text-primary" />
            Thử nghiệm tìm kiếm
          </Button>

          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="gap-2"
            disabled={isRbacLoading || !workspaceId}
          >
            <Plus className="size-4" />
            Thêm bài viết
          </Button>
        </div>
      }
    >
      {workspaceId && (
        <KnowledgeArticleTable
          workspaceId={workspaceId}
          onEditArticle={article => setArticleToEdit(article)}
          onDeleteArticle={article => setArticleToDelete(article)}
          onOpenCreate={() => setIsCreateOpen(true)}
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
    </SettingsPageLayout>
  );
}
