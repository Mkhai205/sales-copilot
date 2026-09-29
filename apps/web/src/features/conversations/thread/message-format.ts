import { format, parseISO, isValid } from 'date-fns';

export function formatMessageTime(dateInput?: string): string {
  if (!dateInput) return '';
  const date = parseISO(dateInput);
  if (!isValid(date)) return '';
  return format(date, 'h:mm a');
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
