'use client';

import * as React from 'react';
import {
  MoreVertical,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { KNOWLEDGE_CATEGORY_LABELS } from './knowledge-article-dialog';
import {
  useKnowledgeArticles,
  useReindexKnowledgeArticle,
  useUpdateKnowledgeArticle,
} from '../../hooks/use-knowledge';

interface KnowledgeArticleTableProps {
  workspaceId: string;
  onEditArticle: (article: KnowledgeArticleDto) => void;
  onDeleteArticle: (article: KnowledgeArticleDto) => void;
  onOpenCreate: () => void;
  onOpenTestSearch: () => void;
}

export function KnowledgeArticleTable({
  workspaceId,
  onEditArticle,
  onDeleteArticle,
  onOpenCreate,
  onOpenTestSearch: _onOpenTestSearch,
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

  const renderStatusBadge = (article: KnowledgeArticleDto) => {
    switch (article.embeddingStatus) {
      case 'READY':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-normal text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Sẵn sàng
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 font-normal text-xs">
            <Spinner className="h-3 w-3" />
            Đang xử lý
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge
            variant="outline"
            className="text-amber-600 border-amber-300 gap-1 font-normal text-xs"
          >
            <Clock className="h-3 w-3" />
            Chờ vector
          </Badge>
        );
      case 'FAILED':
        return (
          <div className="flex items-center gap-1.5">
            <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 font-normal text-xs">
              <AlertTriangle className="h-3 w-3" />
              Lỗi vector
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Thử lại re-index"
              onClick={() => reindexArticle(article.id)}
              disabled={isReindexing}
            >
              <RotateCw className="h-3 w-3" />
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm tiêu đề, nội dung..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            type="button"
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedCategory('all');
              setPage(1);
            }}
            className="text-xs h-8"
          >
            Tất cả
          </Button>
          {Object.entries(KNOWLEDGE_CATEGORY_LABELS).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant={selectedCategory === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedCategory(key);
                setPage(1);
              }}
              className="text-xs h-8"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

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

                  <TableCell className="align-top py-3.5">{renderStatusBadge(article)}</TableCell>

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
