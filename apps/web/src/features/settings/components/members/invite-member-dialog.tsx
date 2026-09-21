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
import { useAddWorkspaceMember } from '../../hooks/use-workspace-members';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function InviteMemberDialog({ open, onOpenChange, workspaceId }: InviteMemberDialogProps) {
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState<AssignableWorkspaceRole>(WorkspaceRole.AGENT);
  const [touched, setTouched] = React.useState(false);

  const { mutate: addMember, isPending } = useAddWorkspaceMember(workspaceId);

  // Validate email
  const emailError = React.useMemo(() => {
    if (!touched) return null;
    const res = addWorkspaceMemberSchema.safeParse({ email, name: name.trim() || undefined, role });
    if (!res.success) {
      const issue = res.error.issues.find(i => i.path.includes('email'));
      return issue?.message || 'Email không hợp lệ';
    }
    return null;
  }, [email, name, role, touched]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    const res = addWorkspaceMemberSchema.safeParse({
      email,
      name: name.trim() || undefined,
      role,
    });
    if (!res.success) return;

    addMember(res.data, {
      onSuccess: () => {
        setEmail('');
        setName('');
        setRole(WorkspaceRole.AGENT);
        setTouched(false);
        onOpenChange(false);
      },
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setEmail('');
      setName('');
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
                Thêm nhân viên vào cửa hàng
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Tạo tài khoản nhân viên mới. Hệ thống sẽ tự động tạo tài khoản và gửi email chứa thông
              tin đăng nhập tới nhân viên.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4 py-2">
            {/* Name Field */}
            <Field>
              <FieldLabel htmlFor="invite-name">Họ và tên nhân viên</FieldLabel>
              <Input
                id="invite-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nguyễn Văn B"
                className="text-xs"
              />
              <FieldDescription>Tên hiển thị của nhân viên (tùy chọn).</FieldDescription>
            </Field>

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
                placeholder="nhanvien@congty.vn"
                aria-invalid={!!emailError}
                required
                className="text-xs"
              />
              <FieldDescription>
                Email đăng nhập của nhân viên để nhận thông tin tài khoản.
              </FieldDescription>
              {emailError && <FieldError errors={[{ message: emailError }]} />}
            </Field>

            {/* Role Select Field */}
            <Field>
              <FieldLabel htmlFor="invite-role">Vai trò trong Cửa hàng</FieldLabel>
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
                Xác định các mục và quyền hạn mà nhân viên này có thể truy cập.
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
                  Đang tạo...
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" data-icon="inline-start" />
                  Tạo tài khoản
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
