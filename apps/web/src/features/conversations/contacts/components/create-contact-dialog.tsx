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
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaces } from '@/features/settings';
import { useCreateContact } from '../hooks/use-contacts';
import type { ContactDto } from '@sales-copilot/shared-contracts';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  onContactCreated?: (contact: ContactDto) => void;
}

export function CreateContactDialog({
  open,
  onOpenChange,
  workspaceSlug,
  onContactCreated,
}: CreateContactDialogProps) {
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug) || workspaces?.[0];
  const workspaceId = currentWorkspace?.id;

  const createContactMutation = useCreateContact({ workspaceSlug, workspaceId });

  // Form State
  const [name, setName] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [identifier, setIdentifier] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const resetForm = () => {
    setName('');
    setPhoneNumber('');
    setEmail('');
    setIdentifier('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Tên khách hàng là bắt buộc');
      return;
    }

    try {
      const created = await createContactMutation.mutateAsync({
        name: name.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        email: email.trim() || undefined,
        identifier: identifier.trim() || undefined,
        customAttributes: notes.trim() ? { notes: notes.trim() } : undefined,
      });

      resetForm();
      onOpenChange(false);
      onContactCreated?.(created);
    } catch {
      // Error handled in hook toast
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-4 text-primary" />
              <span>Thêm mới khách hàng</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tạo hồ sơ khách hàng mới trong danh bạ quản lý của shop.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 py-4 text-xs">
            <div className="grid gap-1">
              <Label htmlFor="contact-name" className="text-xs">
                Họ và tên <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-name"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="contact-phone" className="text-xs">
                  Số điện thoại
                </Label>
                <Input
                  id="contact-phone"
                  placeholder="0912345678"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="contact-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="khachhang@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="contact-identifier" className="text-xs">
                Mã khách hàng nội bộ (Identifier)
              </Label>
              <Input
                id="contact-identifier"
                placeholder="Ví dụ: KH-001"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="contact-notes" className="text-xs">
                Ghi chú ban đầu
              </Label>
              <Textarea
                id="contact-notes"
                placeholder="Nhập sở thích, địa chỉ hoặc ghi chú đặc biệt..."
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={createContactMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || createContactMutation.isPending}
            >
              {createContactMutation.isPending && (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              )}
              Tạo khách hàng
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
