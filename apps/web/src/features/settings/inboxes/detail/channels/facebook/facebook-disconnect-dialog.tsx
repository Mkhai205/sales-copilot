'use client';

import { PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FacebookDisconnectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pageName: string;
  isUpdating: boolean;
  onDisconnect: () => void;
}

export function FacebookDisconnectDialog({
  isOpen,
  onOpenChange,
  pageName,
  isUpdating,
  onDisconnect,
}: FacebookDisconnectDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <PowerOff className="size-4" />
            Ngắt kết nối Facebook Fanpage
          </DialogTitle>
          <DialogDescription className="text-xs">
            Bạn có chắc chắn muốn ngắt kết nối Fanpage <strong>{pageName}</strong> khỏi Sales
            Copilot không?
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 text-xs text-muted-foreground flex flex-col gap-2">
          <p>Khi ngắt kết nối:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Webhook tiếp nhận sự kiện từ Facebook sẽ được hủy đăng ký an toàn.</li>
            <li>Tin nhắn mới và bình luận sẽ tạm dừng đồng bộ về hệ thống.</li>
            <li>
              <strong>
                Toàn bộ lịch sử tin nhắn, đơn hàng và danh bạ khách hàng cũ vẫn được bảo lưu 100%.
              </strong>
            </li>
            <li>Bạn có thể kết nối lại Fanpage bất kỳ lúc nào bằng 1 cú nhấp chuột.</li>
          </ul>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isUpdating}
            onClick={onDisconnect}
            className="h-8 text-xs font-medium"
          >
            {isUpdating ? <Spinner className="size-3.5" /> : 'Xác nhận ngắt kết nối'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
