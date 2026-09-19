'use client';

import * as React from 'react';
import { UserPlus } from 'lucide-react';
import {
  type AssignableWorkspaceRole,
  WorkspaceRole,
  addWorkspaceMemberSchema,
} from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAddWorkspaceMember } from './hooks/use-workspace-members';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function InviteMemberDialog({ open, onOpenChange, workspaceId }: InviteMemberDialogProps) {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<AssignableWorkspaceRole>(WorkspaceRole.AGENT);
  const [touched, setTouched] = React.useState(false);

  const { mutate: addMember, isPending } = useAddWorkspaceMember(workspaceId);

  // Validate email
  const emailError = React.useMemo(() => {
    if (!touched) return null;
    const res = addWorkspaceMemberSchema.safeParse({ email, role });
    if (!res.success) {
      const issue = res.error.issues.find(i => i.path.includes('email'));
      return issue?.message || 'Email không hợp lệ';
    }
    return null;
  }, [email, role, touched]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    const res = addWorkspaceMemberSchema.safeParse({ email, role });
    if (!res.success) return;

    addMember(res.data, {
      onSuccess: () => {
        setEmail('');
        setRole(WorkspaceRole.AGENT);
        setTouched(false);
        onOpenChange(false);
      },
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setEmail('');
      setRole(WorkspaceRole.AGENT);
      setTouched(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              <DialogTitle className="text-sm font-semibold">
                Mời thành viên vào không gian làm việc
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Thêm đồng nghiệp vào không gian làm việc. Lời mời sẽ được gửi tới email của họ.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4 py-2">
            {/* Email Field */}
            <Field data-invalid={!!emailError}>
              <FieldLabel htmlFor="invite-email">Địa chỉ Email</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (!touched) setTouched(true);
                }}
                placeholder="colleague@company.com"
                aria-invalid={!!emailError}
                required
                className="text-xs"
              />
              <FieldDescription>
                Phải là email của người dùng đã đăng ký trong hệ thống.
              </FieldDescription>
              {emailError && <FieldError errors={[{ message: emailError }]} />}
            </Field>

            {/* Role Select Field */}
            <Field>
              <FieldLabel htmlFor="invite-role">Vai trò trong Workspace</FieldLabel>
              <Select value={role} onValueChange={(val: AssignableWorkspaceRole) => setRole(val)}>
                <SelectTrigger id="invite-role" className="w-full text-xs">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={WorkspaceRole.ADMIN} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">Quản trị viên (Admin)</span>
                      <span className="text-[11px] text-muted-foreground">
                        Toàn quyền truy cập tất cả cài đặt, thành viên, hộp thư và vận hành.
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value={WorkspaceRole.AGENT} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">Nhân viên hỗ trợ (Agent)</span>
                      <span className="text-[11px] text-muted-foreground">
                        Quản lý các cuộc hội thoại, câu trả lời mẫu, nhãn và danh bạ.
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Xác định các mục và quyền quản trị mà người dùng này có thể truy cập.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isPending || !email.trim()}
              className="text-xs font-medium"
            >
              {isPending ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  Đang mời...
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" data-icon="inline-start" />
                  Mời thành viên
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
