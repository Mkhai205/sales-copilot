'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useWorkspaces } from '@/features/settings';
import { useContacts, useDeleteContact } from '../hooks/use-contacts';
import { ContactsTable } from './contacts-table';
import { ContactDetailDialog } from './contact-detail-dialog';
import { CreateContactDialog } from './create-contact-dialog';
import { MergeContactsDialog } from './merge-contacts-dialog';
import { ChannelType, type ContactDto } from '@sales-copilot/shared-contracts';
import { Loader2, Plus, RefreshCw, Search, Users, X, Filter } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

interface ContactsViewProps {
  workspaceSlug: string;
}

export function ContactsView({ workspaceSlug }: ContactsViewProps) {
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug) || workspaces?.[0];
  const workspaceId = currentWorkspace?.id;

  // Filter & Pagination State
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>('');
  const [channelFilter, setChannelFilter] = React.useState<string>('ALL');
  const [page, setPage] = React.useState<number>(1);
  const [limit] = React.useState<number>(20);

  // Modal / Sheet States
  const [selectedContact, setSelectedContact] = React.useState<ContactDto | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState<boolean>(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState<boolean>(false);
  const [mergeTarget, setMergeTarget] = React.useState<ContactDto | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState<boolean>(false);
  const [contactToDelete, setContactToDelete] = React.useState<ContactDto | null>(null);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const deleteContactMutation = useDeleteContact({ workspaceSlug, workspaceId });

  // Query contacts
  const effectiveChannel = channelFilter !== 'ALL' ? (channelFilter as ChannelType) : undefined;

  const {
    items: contacts,
    meta,
    isLoading,
    refetch,
    isFetching,
  } = useContacts({
    workspaceSlug,
    workspaceId,
    query: {
      page,
      limit,
      q: debouncedSearch || undefined,
      channelType: effectiveChannel,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
  });

  const handleSelectContact = (contact: ContactDto) => {
    setSelectedContact(contact);
    setSheetOpen(true);
  };

  const handleMergeContact = (contact: ContactDto) => {
    setMergeTarget(contact);
    setMergeDialogOpen(true);
  };

  const handleDeleteClick = (contact: ContactDto) => {
    setContactToDelete(contact);
  };

  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;
    await deleteContactMutation.mutateAsync(contactToDelete.id);
    if (selectedContact?.id === contactToDelete.id) {
      setSheetOpen(false);
    }
    setContactToDelete(null);
  };

  const hasActiveFilters = Boolean(searchTerm || channelFilter !== 'ALL');

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setChannelFilter('ALL');
    setPage(1);
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-y-auto bg-background p-6 gap-5">
      <PageHeader
        title="Danh bạ khách hàng"
        description="Quản lý thông tin định danh, lịch sử tương tác và đơn hàng trên toàn bộ các kênh tiếp nhận."
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Thêm khách hàng</span>
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border/70 shadow-2xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, SĐT, email, mã KH..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs bg-background"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="size-3.5" />
                <span className="sr-only">Xóa từ khóa</span>
              </button>
            )}
          </div>

          {/* Channel Type Filter */}
          <div className="w-full sm:w-52">
            <Select
              value={channelFilter}
              onValueChange={val => {
                setChannelFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-full text-xs bg-background">
                <div className="flex items-center gap-1.5 truncate">
                  <Filter className="size-3 text-primary shrink-0" />
                  <SelectValue placeholder="Lọc theo kênh" />
                </div>
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value="ALL">Tất cả kênh</SelectItem>
                <SelectItem value={ChannelType.FACEBOOK_MESSENGER}>Facebook Messenger</SelectItem>
                <SelectItem value={ChannelType.TELEGRAM}>Telegram</SelectItem>
                <SelectItem value={ChannelType.ZALO}>Zalo</SelectItem>
                <SelectItem value={ChannelType.WEB_CHAT}>Web Chat</SelectItem>
                <SelectItem value={ChannelType.EMAIL}>Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 text-xs px-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3 mr-1" />
              <span>Đặt lại</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <ContactsTable
        contacts={contacts}
        isLoading={isLoading}
        meta={meta}
        workspaceSlug={workspaceSlug}
        onSelectContact={handleSelectContact}
        onMergeContact={handleMergeContact}
        onDeleteContact={handleDeleteClick}
        onPageChange={setPage}
      />

      {/* Detail Dialog */}
      <ContactDetailDialog
        contact={selectedContact}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        workspaceSlug={workspaceSlug}
        onMergeContact={handleMergeContact}
      />

      {/* Create Contact Dialog */}
      <CreateContactDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspaceSlug={workspaceSlug}
        onContactCreated={created => {
          setSelectedContact(created);
          setSheetOpen(true);
        }}
      />

      {/* Merge Contacts Dialog */}
      <MergeContactsDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        workspaceSlug={workspaceSlug}
        initialBaseContact={mergeTarget}
        onMergeSuccess={() => {
          if (sheetOpen) setSheetOpen(false);
          setMergeTarget(null);
          refetch();
        }}
      />

      {/* Confirm Delete Alert Dialog */}
      <AlertDialog
        open={Boolean(contactToDelete)}
        onOpenChange={open => !open && setContactToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa hồ sơ khách hàng{' '}
              <strong className="text-foreground">{contactToDelete?.name}</strong>? Thao tác này sẽ
              xoá hồ sơ khách hàng khỏi danh bạ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteContactMutation.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteContactMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteContactMutation.isPending && (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              )}
              Xác nhận xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
