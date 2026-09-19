'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getChannelMeta } from '@/lib/channels';
import type { ContactDto, PaginationMeta } from '@sales-copilot/shared-contracts';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Eye,
  GitMerge,
  MoreHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

function formatDateTime(dateInput: Date | string): string {
  try {
    const d = new Date(dateInput);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateInput);
  }
}

export interface ContactsTableProps {
  contacts: ContactDto[];
  isLoading?: boolean;
  meta?: PaginationMeta;
  workspaceSlug: string;
  onSelectContact: (contact: ContactDto) => void;
  onMergeContact: (contact: ContactDto) => void;
  onDeleteContact: (contact: ContactDto) => void;
  onPageChange?: (newPage: number) => void;
}

export function ContactsTable({
  contacts,
  isLoading = false,
  meta,
  onSelectContact,
  onMergeContact,
  onDeleteContact,
  onPageChange,
}: ContactsTableProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, text: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    toast.success(`Đã sao chép ${label}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const page = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? contacts.length;

  if (isLoading) {
    return (
      <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/40 text-[11px]">
            <TableRow>
              <TableHead className="min-w-[220px]">Khách hàng</TableHead>
              <TableHead className="w-48">Kênh kết nối</TableHead>
              <TableHead className="w-40">Điện thoại</TableHead>
              <TableHead className="w-48">Email</TableHead>
              <TableHead className="w-40">Ngày tạo</TableHead>
              <TableHead className="w-20 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, idx) => (
              <TableRow key={idx}>
                {Array.from({ length: 6 }).map((_, cIdx) => (
                  <TableCell key={cIdx} className="py-3">
                    <div className="h-4 w-full bg-muted/60 animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/40 text-[11px]">
            <TableRow>
              <TableHead className="min-w-[220px]">Khách hàng</TableHead>
              <TableHead className="w-48">Kênh kết nối</TableHead>
              <TableHead className="w-40">Điện thoại</TableHead>
              <TableHead className="w-48">Email</TableHead>
              <TableHead className="w-40">Ngày tạo</TableHead>
              <TableHead className="w-20 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <div className="rounded-full bg-muted/50 p-3">
                      <Users className="size-6 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Không tìm thấy khách hàng nào
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Thử thay đổi từ khóa tìm kiếm hoặc lọc theo kênh khác.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map(contact => {
                const initials = (contact.name || 'K')
                  .split(' ')
                  .map(n => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const identities = contact.identities || [];

                return (
                  <TableRow
                    key={contact.id}
                    onClick={() => onSelectContact(contact)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors group"
                  >
                    {/* Contact Profile */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="size-8 ring-1 ring-border/50 shrink-0">
                          <AvatarImage
                            src={contact.avatarUrl || '/avatar-contact-default.svg'}
                            alt={contact.name}
                          />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                            {contact.name}
                          </p>
                          {contact.identifier && (
                            <p className="truncate text-[11px] text-muted-foreground font-mono">
                              #{contact.identifier}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Channels */}
                    <TableCell className="py-2.5">
                      {identities.length === 0 ? (
                        <span className="text-xs text-muted-foreground/60 italic">
                          Chưa liên kết
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {identities.slice(0, 3).map((id, iIdx) => {
                            const meta = getChannelMeta(id.channelType);
                            const handle = id.username ? `@${id.username}` : id.externalContactId;
                            return (
                              <Tooltip key={id.id || iIdx}>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="px-1.5 py-0.5 text-[10px] gap-1 font-normal bg-background/80 hover:bg-muted"
                                  >
                                    <Image
                                      src={meta.iconSrc}
                                      alt={meta.label}
                                      width={12}
                                      height={12}
                                      unoptimized
                                      className="size-3 object-contain"
                                    />
                                    <span className="max-w-[80px] truncate">{meta.label}</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">
                                    {meta.label}: {handle}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                          {identities.length > 3 && (
                            <Badge variant="secondary" className="px-1 text-[10px] h-5">
                              +{identities.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Phone */}
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {contact.phoneNumber ? (
                        <div className="flex items-center gap-1 group/phone">
                          <span className="truncate text-foreground">{contact.phoneNumber}</span>
                          <button
                            type="button"
                            onClick={e =>
                              handleCopy(e, contact.phoneNumber!, `phone-${contact.id}`)
                            }
                            className="opacity-0 group-hover/phone:opacity-100 hover:text-foreground text-muted-foreground p-0.5 transition-opacity"
                            title="Sao chép số điện thoại"
                          >
                            {copiedId === `phone-${contact.id}` ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>

                    {/* Email */}
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {contact.email ? (
                        <div className="flex items-center gap-1 group/email">
                          <span
                            className="truncate max-w-[170px] text-foreground"
                            title={contact.email}
                          >
                            {contact.email}
                          </span>
                          <button
                            type="button"
                            onClick={e => handleCopy(e, contact.email!, `email-${contact.id}`)}
                            className="opacity-0 group-hover/email:opacity-100 hover:text-foreground text-muted-foreground p-0.5 transition-opacity"
                            title="Sao chép email"
                          >
                            {copiedId === `email-${contact.id}` ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>

                    {/* Created Date */}
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {formatDateTime(contact.createdAt)}
                    </TableCell>

                    {/* Row Actions */}
                    <TableCell className="py-2.5 text-right" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Thao tác</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-xs">
                          <DropdownMenuItem
                            onClick={() => onSelectContact(contact)}
                            className="gap-2 cursor-pointer"
                          >
                            <Eye className="size-3.5 text-muted-foreground" />
                            <span>Xem chi tiết</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onMergeContact(contact)}
                            className="gap-2 cursor-pointer"
                          >
                            <GitMerge className="size-3.5 text-muted-foreground" />
                            <span>Gộp khách hàng</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeleteContact(contact)}
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Xóa khách hàng</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {total > 0 && (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <p>
            Trang <span className="font-semibold text-foreground">{page}</span> / {totalPages} (Tổng{' '}
            <span className="font-semibold text-foreground">{total}</span> khách hàng)
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="h-8 gap-1 text-xs cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
              <span>Trước</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              className="h-8 gap-1 text-xs cursor-pointer"
            >
              <span>Sau</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
