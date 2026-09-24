'use client';

import * as React from 'react';
import { MoreVertical, Pencil, Trash2, RefreshCw, BookOpen } from 'lucide-react';
import type { KnowledgeArticleDto } from '@sales-copilot/shared-contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
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

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <KnowledgeArticleToolbar
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />

      {/* Table Container */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45%]">Tiêu đề & Nội dung</TableHead>
              <TableHead className="w-[15%]">Danh mục</TableHead>
              <TableHead className="w-[12%]">Trạng thái Bot</TableHead>
              <TableHead className="w-[15%]">Trạng thái Vector</TableHead>
              <TableHead className="w-[13%] text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Spinner className="h-6 w-6 text-primary" />
                    <span className="text-sm">Đang tải danh sách bài viết...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <BookOpen className="h-6 w-6 opacity-60" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Chưa có bài viết kiến thức nào
                      </p>
                      <p className="text-xs max-w-sm">
                        Thêm bài viết về chính sách đổi trả, bảo hành, phí ship... để AI Chatbot tự
                        động trả lời khách hàng.
                      </p>
                    </div>
                    <Button size="sm" onClick={onOpenCreate}>
                      Thêm bài viết đầu tiên
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article: KnowledgeArticleDto) => (
                <TableRow key={article.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="align-top py-3.5">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground text-sm flex items-center gap-2">
                        {article.title}
                        {!article.isActive && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1 text-muted-foreground"
                          >
                            Tạm ẩn
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {article.content}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell className="align-top py-3.5">
                    {article.category ? (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {KNOWLEDGE_CATEGORY_LABELS[article.category] || article.category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="align-top py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(article)}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                        article.isActive
                          ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {article.isActive ? 'Đang bật' : 'Tạm tắt'}
                    </button>
                  </TableCell>

                  <TableCell className="align-top py-3.5">
                    <KnowledgeStatusBadge
                      status={article.embeddingStatus}
                      onReindex={() => reindexArticle(article.id)}
                      isReindexing={isReindexing}
                    />
                  </TableCell>

                  <TableCell className="align-top py-3.5 text-right">
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination & Count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Hiển thị {articles.length} / {meta.total} bài viết
        </span>
        {meta.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="h-8 text-xs"
            >
              Trang trước
            </Button>
            <span>
              Trang {meta.page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages || isFetching}
              onClick={() => setPage(p => p + 1)}
              className="h-8 text-xs"
            >
              Trang sau
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
