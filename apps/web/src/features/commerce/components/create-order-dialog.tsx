'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CommerceOrderForm } from './commerce-order-form';
import { useContacts } from '@/features/contacts/hooks/use-contacts';
import { contactsApi } from '@/features/contacts/api/contacts';
import { useI18n } from '@/lib/i18n';
import type { ContactDto, OrderResponseDto } from '@sales-copilot/shared-contracts';
import { CarrierBadge } from './carrier-badge';
import { User, Search, Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onOrderCreated?: (order: OrderResponseDto) => void;
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  workspaceId,
  onOrderCreated,
}: CreateOrderDialogProps) {
  const { t } = useI18n();

  const [selectedContact, setSelectedContact] = React.useState<ContactDto | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCreatingContact, setIsCreatingContact] = React.useState(false);
  const [newCustomerName, setNewCustomerName] = React.useState('');
  const [newCustomerPhone, setNewCustomerPhone] = React.useState('');
  const [isNewCustomerMode, setIsNewCustomerMode] = React.useState(false);

  // Fetch contacts for workspace
  const { data: contacts, isLoading: isContactsLoading } = useContacts({
    workspaceId,
    enabled: open && !selectedContact,
    query: searchTerm.trim() ? { q: searchTerm.trim() } : undefined,
  });

  // Reset state when dialog is closed
  React.useEffect(() => {
    if (!open) {
      setSelectedContact(null);
      setSearchTerm('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setIsNewCustomerMode(false);
    }
  }, [open]);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      toast.error(t('commerce.form.validationCustomerRequired'));
      return;
    }

    setIsCreatingContact(true);
    try {
      const res = await contactsApi.create(workspaceId, {
        name: newCustomerName.trim(),
        phoneNumber: newCustomerPhone.trim() || undefined,
      });
      setSelectedContact(res.data);
      setIsNewCustomerMode(false);
    } catch (err: any) {
      toast.error(err?.error?.message || err?.message || t('common.retry'));
    } finally {
      setIsCreatingContact(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border/70 shrink-0 bg-muted/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-foreground">
              {t('commerce.orders.createDialog.title')}
            </DialogTitle>
            {selectedContact && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setSelectedContact(null)}
              >
                <ArrowLeft className="size-3.5" />
                <span>{t('commerce.cascader.selectProvinceFirst')}</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {!selectedContact ? (
            <div className="space-y-4">
              {/* Customer Selector Mode */}
              {!isNewCustomerMode ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={t('commerce.orders.createDialog.searchCustomer')}
                        className="pl-8 text-xs h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs gap-1.5 cursor-pointer shrink-0"
                      onClick={() => setIsNewCustomerMode(true)}
                    >
                      <Plus className="size-3.5" />
                      <span>{t('commerce.orders.createDialog.quickFill')}</span>
                    </Button>
                  </div>

                  {/* Contacts List */}
                  <div className="rounded-md border divide-y max-h-72 overflow-y-auto bg-card">
                    {isContactsLoading ? (
                      <div className="p-6 flex items-center justify-center text-xs text-muted-foreground gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        <span>{t('common.loading')}</span>
                      </div>
                    ) : (contacts || []).length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        <p>{t('commerce.orders.createDialog.noCustomerFound')}</p>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="mt-1 text-xs cursor-pointer"
                          onClick={() => setIsNewCustomerMode(true)}
                        >
                          {t('commerce.orders.createDialog.quickFill')}
                        </Button>
                      </div>
                    ) : (
                      (contacts || []).map(contact => (
                        <div
                          key={contact.id}
                          onClick={() => setSelectedContact(contact)}
                          className="p-2.5 hover:bg-muted/40 cursor-pointer flex items-center justify-between transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px] shrink-0">
                              {contact.name?.[0]?.toUpperCase() || 'C'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">
                                {contact.name}
                              </div>
                              {contact.phoneNumber && (
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {contact.phoneNumber}
                                </div>
                              )}
                            </div>
                          </div>
                          {contact.phoneNumber && <CarrierBadge phone={contact.phoneNumber} />}
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                /* Quick Create Customer Form */
                <form onSubmit={handleCreateContact} className="space-y-3 p-2">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <User className="size-3.5 text-primary" />
                    <span>{t('commerce.orders.createDialog.quickFill')}</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      {t('commerce.orders.createDialog.customerName')}{' '}
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(e.target.value)}
                      placeholder={t('commerce.recipient.namePlaceholder')}
                      className="text-xs"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      {t('commerce.orders.createDialog.customerPhone')}
                    </label>
                    <Input
                      value={newCustomerPhone}
                      onChange={e => setNewCustomerPhone(e.target.value)}
                      placeholder={t('commerce.recipient.phonePlaceholder')}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsNewCustomerMode(false)}
                      disabled={isCreatingContact}
                      className="text-xs"
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                      size="sm"
                      disabled={isCreatingContact || !newCustomerName.trim()}
                      className="text-xs font-semibold"
                    >
                      {isCreatingContact ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        t('common.confirm')
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Selected Contact Header + CommerceOrderForm */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 text-xs">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-primary" />
                  <div>
                    <span className="font-semibold text-foreground">{selectedContact.name}</span>
                    {selectedContact.phoneNumber && (
                      <span className="ml-2 font-mono text-muted-foreground">
                        {selectedContact.phoneNumber}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => setSelectedContact(null)}
                >
                  {t('common.edit')}
                </Button>
              </div>

              <CommerceOrderForm
                workspaceId={workspaceId}
                contactId={selectedContact.id}
                contactName={selectedContact.name}
                contactPhone={selectedContact.phoneNumber}
                onCancel={() => setSelectedContact(null)}
                onSuccess={order => {
                  onOpenChange(false);
                  if (onOrderCreated) {
                    onOrderCreated(order);
                  }
                }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
