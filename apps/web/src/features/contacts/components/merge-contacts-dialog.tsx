'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorkspaces } from '@/features/identity';
import { useContacts, useMergeContacts } from '../hooks/use-contacts';
import type { ContactDto } from '@sales-copilot/shared-contracts';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Check,
  GitMerge,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

export interface MergeContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  initialBaseContact: ContactDto | null;
  onMergeSuccess?: () => void;
}

export function MergeContactsDialog({
  open,
  onOpenChange,
  workspaceSlug,
  initialBaseContact,
  onMergeSuccess,
}: MergeContactsDialogProps) {
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug) || workspaces?.[0];
  const workspaceId = currentWorkspace?.id;

  const [baseContact, setBaseContact] = React.useState<ContactDto | null>(initialBaseContact);
  const [mergeeContact, setMergeeContact] = React.useState<ContactDto | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    setBaseContact(initialBaseContact);
    setMergeeContact(null);
    setSearchTerm('');
  }, [initialBaseContact, open]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search contacts for mergee candidate
  const { data: searchResults, isLoading: isSearching } = useContacts({
    workspaceSlug,
    workspaceId,
    enabled: open && !mergeeContact,
    query: debouncedSearch ? { q: debouncedSearch, limit: 10 } : { limit: 10 },
  });

  const mergeMutation = useMergeContacts({ workspaceSlug, workspaceId });

  const handleSwap = () => {
    if (!baseContact || !mergeeContact) return;
    const temp = baseContact;
    setBaseContact(mergeeContact);
    setMergeeContact(temp);
  };

  const handleConfirmMerge = async () => {
    if (!baseContact || !mergeeContact) return;
    if (baseContact.id === mergeeContact.id) {
      toast.error('Không thể gộp một liên hệ với chính nó');
      return;
    }

    try {
      await mergeMutation.mutateAsync({
        baseContactId: baseContact.id,
        mergeeContactId: mergeeContact.id,
      });

      onOpenChange(false);
      onMergeSuccess?.();
    } catch {
      // Error handled in hook toast
    }
  };

  const filteredCandidates = (searchResults || []).filter(c => c.id !== baseContact?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="p-5 pb-3 border-b border-border/70">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitMerge className="size-4 text-primary" />
            <span>Gộp khách hàng (Merge Contacts)</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Hợp nhất hai hồ sơ khách hàng trùng lặp thành một hồ sơ duy nhất, tự động gộp mọi kênh
            chat và đơn hàng.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Top Selector Grid: Base vs Mergee */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch relative">
            {/* Base Contact Card */}
            <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4">
                    Liên hệ chính (GIỮ LẠI)
                  </Badge>
                </div>
                {baseContact ? (
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-9 ring-1 ring-border shrink-0">
                      <AvatarImage src={baseContact.avatarUrl || '/avatar-contact-default.svg'} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                        {baseContact.name?.[0] || 'K'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-xs truncate">
                        {baseContact.name}
                      </p>
                      <p className="text-muted-foreground text-[11px] truncate">
                        {baseContact.phoneNumber ||
                          baseContact.email ||
                          'Chưa có thông tin liên hệ'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Chưa chọn liên hệ</p>
                )}
              </div>
            </div>

            {/* Mergee Contact Card */}
            <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                    Liên hệ phụ (SẼ BỊ XOÁ)
                  </Badge>
                  {mergeeContact && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setMergeeContact(null)}
                      className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Chọn lại
                    </Button>
                  )}
                </div>
                {mergeeContact ? (
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-9 ring-1 ring-border shrink-0">
                      <AvatarImage src={mergeeContact.avatarUrl || '/avatar-contact-default.svg'} />
                      <AvatarFallback className="bg-destructive/20 text-destructive text-xs font-bold">
                        {mergeeContact.name?.[0] || 'K'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-xs truncate">
                        {mergeeContact.name}
                      </p>
                      <p className="text-muted-foreground text-[11px] truncate">
                        {mergeeContact.phoneNumber ||
                          mergeeContact.email ||
                          'Chưa có thông tin liên hệ'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="size-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                      <Input
                        placeholder="Tìm khách hàng cần gộp..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-8 pl-7 text-xs bg-background"
                      />
                    </div>

                    <div className="rounded-md border bg-card max-h-36 overflow-y-auto divide-y">
                      {isSearching ? (
                        <div className="p-3 text-center text-muted-foreground flex items-center justify-center gap-1.5">
                          <Loader2 className="size-3 animate-spin" />
                          <span>Đang tìm kiếm...</span>
                        </div>
                      ) : filteredCandidates.length === 0 ? (
                        <div className="p-3 text-center text-muted-foreground text-[11px]">
                          Không tìm thấy khách hàng nào phù hợp
                        </div>
                      ) : (
                        filteredCandidates.map(candidate => (
                          <div
                            key={candidate.id}
                            onClick={() => setMergeeContact(candidate)}
                            className="p-2 hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{candidate.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {candidate.phoneNumber || candidate.email || 'Hồ sơ khách hàng'}
                              </p>
                            </div>
                            <Button size="xs" variant="ghost" className="h-6 text-[10px]">
                              Chọn
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Swap Button */}
          {baseContact && mergeeContact && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleSwap}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <ArrowUpDown className="size-3.5" />
                <span>Hoán đổi vị trí (Chính ⇄ Phụ)</span>
              </Button>
            </div>
          )}

          {/* Diff / Comparison Table */}
          {baseContact && mergeeContact && (
            <div className="rounded-lg border border-border/70 overflow-hidden bg-card">
              <div className="bg-muted/40 p-2.5 font-semibold text-xs border-b">
                Xem trước dữ liệu sau khi gộp
              </div>
              <div className="divide-y text-xs">
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-muted-foreground font-medium">Họ và tên</span>
                  <span className="text-foreground">{baseContact.name}</span>
                  <span className="text-muted-foreground line-through">{mergeeContact.name}</span>
                </div>
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-muted-foreground font-medium">Số điện thoại</span>
                  <span className="text-foreground">
                    {baseContact.phoneNumber || mergeeContact.phoneNumber || '-'}
                  </span>
                  <span className="text-muted-foreground">{mergeeContact.phoneNumber || '-'}</span>
                </div>
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-muted-foreground font-medium">Email</span>
                  <span className="text-foreground">
                    {baseContact.email || mergeeContact.email || '-'}
                  </span>
                  <span className="text-muted-foreground">{mergeeContact.email || '-'}</span>
                </div>
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-muted-foreground font-medium">Kênh chat định danh</span>
                  <span className="text-foreground font-semibold">
                    Được gộp toàn bộ (
                    {(baseContact.identities?.length || 0) +
                      (mergeeContact.identities?.length || 0)}{' '}
                    kênh)
                  </span>
                  <span className="text-emerald-600 font-medium">Chuyển sang chính</span>
                </div>
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-muted-foreground font-medium">Lịch sử chat & Đơn hàng</span>
                  <span className="text-foreground font-semibold">
                    Toàn bộ phiên hội thoại & đơn hàng
                  </span>
                  <span className="text-emerald-600 font-medium">Chuyển sang chính</span>
                </div>
              </div>
            </div>
          )}

          {/* Warning Callout */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="font-semibold block mb-0.5">Lưu ý trước khi thực hiện:</strong>
              Hành động này <strong>không thể hoàn tác</strong>. Hồ sơ liên hệ phụ sẽ bị xoá khỏi hệ
              thống. Tất cả tin nhắn, phiên chat và đơn hàng sẽ được chuyển vĩnh viễn sang liên hệ
              chính.
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border/70 bg-card/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={mergeMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleConfirmMerge}
            disabled={!baseContact || !mergeeContact || mergeMutation.isPending}
            className="bg-primary text-primary-foreground gap-1.5"
          >
            {mergeMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>Xác nhận gộp khách hàng</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
