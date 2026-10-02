import { Download, FileText } from 'lucide-react';
import Link from 'next/link';
import type { AttachmentDto } from '@sales-copilot/shared-contracts';
import { FileType } from '@sales-copilot/shared-contracts';
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

function isVideoAttachment(att: AttachmentDto): boolean {
  return att.fileType === FileType.VIDEO || att.contentType?.startsWith('video/') === true;
}

function isAudioAttachment(att: AttachmentDto): boolean {
  return att.fileType === FileType.AUDIO || att.contentType?.startsWith('audio/') === true;
}

export function MessageFileAttachments({ attachments }: { attachments?: AttachmentDto[] }) {
  if (!attachments || attachments.length === 0) return null;

  const videos = attachments.filter(isVideoAttachment);
  const audios = attachments.filter(isAudioAttachment);
  const files = attachments.filter(att => !isVideoAttachment(att) && !isAudioAttachment(att));

  return (
    <div className="flex flex-col gap-2 mt-1.5 max-w-full">
      {videos.map(
        att =>
          att.fileUrl && (
            <video
              key={att.id || att.fileUrl}
              src={att.fileUrl}
              controls
              preload="metadata"
              className="max-w-xs rounded-lg border bg-black"
            />
          ),
      )}
      {audios.map(
        att =>
          att.fileUrl && (
            <audio key={att.id || att.fileUrl} src={att.fileUrl} controls className="w-64" />
          ),
      )}
      {files.map(att => (
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
