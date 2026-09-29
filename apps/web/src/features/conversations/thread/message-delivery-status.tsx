import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import { DeliveryStatus } from '@sales-copilot/shared-contracts';

export function DeliveryStatusIcon({ status }: { status?: DeliveryStatus }) {
  switch (status) {
    case DeliveryStatus.PENDING:
      return <Clock className="size-3 text-muted-foreground/70" />;
    case DeliveryStatus.SENT:
      return <Check className="size-3 text-muted-foreground" />;
    case DeliveryStatus.DELIVERED:
      return <CheckCheck className="size-3 text-muted-foreground" />;
    case DeliveryStatus.READ:
      return <CheckCheck className="size-3 text-primary" />;
    case DeliveryStatus.FAILED:
      return <AlertCircle className="size-3 text-destructive" />;
    default:
      return null;
  }
}
