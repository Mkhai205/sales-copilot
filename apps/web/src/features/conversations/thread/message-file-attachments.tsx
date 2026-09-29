import { Download, FileText } from 'lucide-react';
import Link from 'next/link';
import type { AttachmentDto } from '@sales-copilot/shared-contracts';
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from '@/components/ui/attachment';
import { formatFileSize } from './message-format';

export function MessageFileAttachments({ attachments }: { attachments?: AttachmentDto[] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-1.5 max-w-full">
      {attachments.map(att => (
        <Attachment key={att.id || att.storagePath} size="sm" className="max-w-xs">
          <AttachmentMedia variant="icon">
            <FileText className="size-4 text-muted-foreground" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle className="text-xs">{att.fileName}</AttachmentTitle>
            <AttachmentDescription className="text-[10px]">
              {formatFileSize(att.fileSize)}
            </AttachmentDescription>
          </AttachmentContent>
          {att.fileUrl && (
            <AttachmentActions>
              <AttachmentAction asChild size="icon-xs" variant="ghost">
                <Link
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.fileName}
                >
                  <Download className="size-3" />
                  <span className="sr-only">Download {att.fileName}</span>
                </Link>
              </AttachmentAction>
            </AttachmentActions>
          )}
        </Attachment>
      ))}
    </div>
  );
}
