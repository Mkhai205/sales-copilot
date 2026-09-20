'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useWorkspaces } from '@/features/settings';
import { conversationsApi } from '@/features/conversations/api/conversations';
import { commerceApi } from '@/features/commerce/api/commerce-client';
import { formatVND } from '@/features/commerce/lib/currency';
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/features/commerce/components/order-status-badge';
import { useContact, useUpdateContact } from '../hooks/use-contacts';
import { ContactIdentities } from '../contact-identities';
import { contactKeys } from '@/lib/query-keys';
import type { ContactDto } from '@sales-copilot/shared-contracts';
import {
  GitMerge,
  MessageSquare,
  ShoppingBag,
  User,
  ExternalLink,
  Loader2,
  Clock,
  Save,
} from 'lucide-react';

function formatDateTime(dateInput?: Date | string | null): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    return d.toLocaleString('vi-VN', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateInput);
  }
}

export interface ContactDetailDialogProps {
  contact: ContactDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  onMergeContact?: (contact: ContactDto) => void;
}

export function ContactDetailDialog({
  contact: initialContact,
  open,
  onOpenChange,
  workspaceSlug,
  onMergeContact,
}: ContactDetailDialogProps) {
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug) || workspaces?.[0];
  const workspaceId = currentWorkspace?.id;

  // Fresh contact detail from server
  const { data: freshContact } = useContact(initialContact?.id, {
    workspaceSlug,
    workspaceId,
    enabled: open && Boolean(initialContact?.id),
  });

  const contact = freshContact || initialContact;
  const updateContactMutation = useUpdateContact(contact?.id || '', {
    workspaceSlug,
    workspaceId,
  });

  // Edit form state
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [identifier, setIdentifier] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setEmail(contact.email || '');
      setPhoneNumber(contact.phoneNumber || '');
      setIdentifier(contact.identifier || '');
      setIsEditing(false);
    }
  }, [contact]);

  // Fetch Conversations history for contact
  const { data: conversations, isLoading: isConversationsLoading } = useQuery({
    queryKey: contactKeys.conversations(workspaceId, contact?.id),
    queryFn: async () => {
      if (!workspaceId || !contact?.id) return [];
      const res = await conversationsApi.list(workspaceId, { contactId: contact.id });
      return res.data || [];
    },
    enabled: open && Boolean(workspaceId && contact?.id),
    staleTime: 30_000,
  });

  // Fetch Orders history for contact
  const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
    queryKey: contactKeys.orders(workspaceId, contact?.id),
    queryFn: async () => {
      if (!workspaceId || !contact?.id) return [];
      const res = await commerceApi.listOrders(workspaceId, { contactId: contact.id });
      return res.data?.items || [];
    },
    enabled: open && Boolean(workspaceId && contact?.id),
    staleTime: 30_000,
  });

  const orders = ordersData || [];

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact?.id) return;

    await updateContactMutation.mutateAsync({
      name: name.trim(),
      email: email.trim() || undefined,
      phoneNumber: phoneNumber.trim() || undefined,
      identifier: identifier.trim() || undefined,
    });

    setIsEditing(false);
  };

  const initials = (contact?.name || 'K')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden bg-background">
        {/* Header */}
        <div className="border-b border-border/70 p-5 bg-card/60 shrink-0">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex items-center gap-3.5 min-w-0">
              <Avatar className="size-12 ring-2 ring-border/50 shrink-0">
                <AvatarImage
                  src={contact?.avatarUrl || '/avatar-contact-default.svg'}
                  alt={contact?.name || 'Khách hàng'}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold truncate text-foreground">
                  {contact?.name || 'Chi tiết khách hàng'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                  {contact?.email || contact?.phoneNumber || 'Hồ sơ liên hệ'}
                  {contact?.identifier ? ` • #${contact.identifier}` : ''}
                </DialogDescription>
              </div>
            </div>

            {contact && onMergeContact && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onMergeContact(contact)}
                className="gap-1.5 text-xs shrink-0 cursor-pointer"
              >
                <GitMerge className="size-3.5" />
                <span>Gộp khách hàng</span>
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-3 border-b border-border/50 bg-card/30">
            <TabsList className="grid grid-cols-3 max-w-md h-9">
              <TabsTrigger value="profile" className="text-xs gap-1.5">
                <User className="size-3.5" />
                <span>Hồ sơ & Kênh</span>
              </TabsTrigger>
              <TabsTrigger value="conversations" className="text-xs gap-1.5">
                <MessageSquare className="size-3.5" />
                <span>Hội thoại ({conversations?.length ?? 0})</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-xs gap-1.5">
                <ShoppingBag className="size-3.5" />
                <span>Đơn hàng ({orders.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            {/* TAB 1: Profile & Identities (Spacious 2-column layout) */}
            <TabsContent value="profile" className="m-0 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Contact Profile Form & Custom Attrs */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="rounded-lg border border-border/60 bg-card p-4 shadow-2xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Thông tin liên hệ
                      </h4>
                      {!isEditing ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setIsEditing(true)}
                          className="h-6 text-[11px] text-primary hover:text-primary/90 cursor-pointer"
                        >
                          Chỉnh sửa
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setIsEditing(false)}
                          className="h-6 text-[11px] text-muted-foreground cursor-pointer"
                        >
                          Hủy
                        </Button>
                      )}
                    </div>

                    <form onSubmit={handleSaveContact} className="grid gap-3.5 text-xs">
                      <div className="grid gap-1">
                        <Label htmlFor="edit-name" className="text-[11px] text-muted-foreground">
                          Họ và tên *
                        </Label>
                        <Input
                          id="edit-name"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          disabled={!isEditing}
                          required
                          className="h-8 text-xs bg-background"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="grid gap-1">
                          <Label htmlFor="edit-phone" className="text-[11px] text-muted-foreground">
                            Số điện thoại
                          </Label>
                          <Input
                            id="edit-phone"
                            value={phoneNumber}
                            onChange={e => setPhoneNumber(e.target.value)}
                            disabled={!isEditing}
                            placeholder="Chưa có"
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="edit-email" className="text-[11px] text-muted-foreground">
                            Email
                          </Label>
                          <Input
                            id="edit-email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            disabled={!isEditing}
                            placeholder="Chưa có"
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      <div className="grid gap-1">
                        <Label
                          htmlFor="edit-identifier"
                          className="text-[11px] text-muted-foreground"
                        >
                          Mã định danh nội bộ (Identifier)
                        </Label>
                        <Input
                          id="edit-identifier"
                          value={identifier}
                          onChange={e => setIdentifier(e.target.value)}
                          disabled={!isEditing}
                          placeholder="VD: KH-001"
                          className="h-8 text-xs font-mono bg-background"
                        />
                      </div>

                      {isEditing && (
                        <div className="flex justify-end pt-1">
                          <Button
                            type="submit"
                            size="xs"
                            disabled={updateContactMutation.isPending}
                            className="gap-1 text-xs cursor-pointer"
                          >
                            {updateContactMutation.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Save className="size-3" />
                            )}
                            <span>Lưu thay đổi</span>
                          </Button>
                        </div>
                      )}
                    </form>
                  </div>

                  {/* Custom Attributes */}
                  {contact?.customAttributes &&
                    Object.keys(contact.customAttributes).length > 0 && (
                      <div className="rounded-lg border border-border/60 bg-card p-4 shadow-2xs">
                        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                          Thuộc tính mở rộng
                        </h4>
                        <div className="rounded-md border divide-y text-xs">
                          {Object.entries(contact.customAttributes).map(([key, val]) => (
                            <div key={key} className="flex items-center justify-between p-2">
                              <span className="text-muted-foreground font-medium">{key}</span>
                              <span className="text-foreground">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {/* Right Column: Connected Identities Card */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="rounded-lg border border-border/60 bg-card p-4 shadow-2xs">
                    <ContactIdentities
                      contactId={contact?.id}
                      workspaceSlug={workspaceSlug}
                      initialIdentities={contact?.identities}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Conversation History */}
            <TabsContent value="conversations" className="m-0 space-y-3">
              {isConversationsLoading ? (
                <div className="flex items-center justify-center p-8 text-xs text-muted-foreground gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Đang tải lịch sử hội thoại...</span>
                </div>
              ) : !conversations || conversations.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg">
                  <MessageSquare className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    Chưa có cuộc hội thoại nào
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Khách hàng này chưa tương tác qua bất kỳ kênh chat nào.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {conv.status}
                          </Badge>
                          <span className="text-xs font-medium text-foreground truncate">
                            {conv.inbox?.name
                              ? `${conv.inbox.name} (#${conv.displayId})`
                              : `Hội thoại #${conv.displayId}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{formatDateTime(conv.lastActivityAt || conv.createdAt)}</span>
                        </p>
                      </div>

                      <Button asChild size="xs" variant="ghost" className="h-7 text-xs gap-1">
                        <Link href={`/${workspaceSlug}/conversations/${conv.id}`}>
                          <span>Mở chat</span>
                          <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: Orders History */}
            <TabsContent value="orders" className="m-0 space-y-3">
              {isOrdersLoading ? (
                <div className="flex items-center justify-center p-8 text-xs text-muted-foreground gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Đang tải lịch sử đơn hàng...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg">
                  <ShoppingBag className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">Chưa có đơn hàng nào</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Khách hàng này chưa phát sinh giao dịch mua hàng.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {orders.map(order => (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          #{order.displayId || order.orderNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <OrderStatusBadge status={order.status} />
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-muted-foreground text-[11px]">
                        <span>
                          Tổng tiền:{' '}
                          <strong className="text-foreground">
                            {formatVND(Number(order.totalAmount))}
                          </strong>
                        </span>
                        <span>{formatDateTime(order.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Backward compatibility alias
export const ContactDetailSheet = ContactDetailDialog;
