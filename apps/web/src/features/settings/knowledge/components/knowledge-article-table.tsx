'use client';

import * as React from 'react';
import { MoreVertical, Pencil, Trash2, RefreshCw, BookOpen } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { KnowledgeArticleDto } from '@sales-copilot/shared-contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/data-table/data-table';
import { KNOWLEDGE_CATEGORY_LABELS } from './knowledge-article-dialog';
import { KnowledgeArticleToolbar } from './knowledge-article-toolbar';
import { KnowledgeStatusBadge } from './knowledge-status-badge';
import {
  useKnowledgeArticles,
  useReindexKnowledgeArticle,
  useUpdateKnowledgeArticle,
} from '../hooks/use-knowledge';

interface KnowledgeArticleTableProps {
  workspaceId: string;
  onEditArticle: (article: KnowledgeArticleDto) => void;
  onDeleteArticle: (article: KnowledgeArticleDto) => void;
  onOpenCreate: () => void;
}

export function KnowledgeArticleTable({
  workspaceId,
  onEditArticle,
  onDeleteArticle,
  onOpenCreate,
}: KnowledgeArticleTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);
  const limit = 10;

  const queryParams = React.useMemo(() => {
    return {
      search: searchTerm.trim() || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      page,
      limit,
    };
  }, [searchTerm, selectedCategory, page]);

  const { data, isLoading, isFetching } = useKnowledgeArticles(workspaceId, queryParams);
  const { mutate: reindexArticle, isPending: isReindexing } =
    useReindexKnowledgeArticle(workspaceId);
  const { mutate: updateArticle } = useUpdateKnowledgeArticle(workspaceId);

  const articles = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

  const handleToggleActive = (article: KnowledgeArticleDto) => {
    updateArticle({
      id: article.id,
      dto: { isActive: !article.isActive },
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const columns = React.useMemo<ColumnDef<KnowledgeArticleDto, any>[]>(
    () => [
      {
        header: 'Tiêu đề & Nội dung',
        meta: { headerClassName: 'w-[45%]' },
        cell: ({ row }) => {
          const article = row.original;
          return (
            <div className="space-y-1">
              <div className="font-medium text-foreground text-sm flex items-center gap-2">
                {article.title}
                {!article.isActive && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 text-muted-foreground">
                    Tạm ẩn
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {article.content}
              </p>
            </div>
          );
        },
      },
      {
        header: 'Danh mục',
        meta: { headerClassName: 'w-[15%]' },
        cell: ({ row }) =>
          row.original.category ? (
            <Badge variant="secondary" className="text-xs font-normal">
              {KNOWLEDGE_CATEGORY_LABELS[row.original.category] || row.original.category}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        header: 'Trạng thái Bot',
        meta: { headerClassName: 'w-[12%]' },
        cell: ({ row }) => {
          const article = row.original;
          return (
            <Button
              type="button"
              variant="ghost"
              className={`h-auto w-auto text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                article.isActive
                  ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => handleToggleActive(article)}
            >
              {article.isActive ? 'Đang bật' : 'Tạm tắt'}
            </Button>
          );
        },
      },
      {
        header: 'Trạng thái Vector',
        meta: { headerClassName: 'w-[15%]' },
        cell: ({ row }) => (
          <KnowledgeStatusBadge
            status={row.original.embeddingStatus}
            onReindex={() => reindexArticle(row.original.id)}
            isReindexing={isReindexing}
          />
        ),
      },
      {
        header: 'Thao tác',
        meta: { headerClassName: 'w-[13%] text-right' },
        cell: ({ row }) => {
          const article = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Thao tác</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onEditArticle(article)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Chỉnh sửa
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => reindexArticle(article.id)}
                    disabled={isReindexing}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-index vector
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteArticle(article)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xóa bài viết
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [handleToggleActive, reindexArticle, isReindexing, onEditArticle, onDeleteArticle],
  );

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <KnowledgeArticleToolbar
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />

      <DataTable
        data={articles}
        columns={columns}
        isLoading={isLoading}
        getRowKey={article => article.id}
        className="rounded-lg border border-border bg-card overflow-hidden [&_td]:py-3.5 [&_td]:align-top [&_tbody_tr:hover]:bg-muted/40"
        emptyState={{
          icon: (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-6 w-6 opacity-60" />
            </div>
          ),
          title: 'Chưa có bài viết kiến thức nào',
          description:
            'Thêm bài viết về chính sách đổi trả, bảo hành, phí ship... để AI Chatbot tự động trả lời khách hàng.',
          action: (
            <Button size="sm" onClick={onOpenCreate}>
              Thêm bài viết đầu tiên
            </Button>
          ),
        }}
        pagination={{
          page: meta.page,
          totalPages: meta.totalPages,
          total: meta.total,
          onPageChange: setPage,
          isLoading: isFetching,
        }}
      />
    </div>
  );
}
