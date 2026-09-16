'use client';

import * as React from 'react';
import { FileText, Sparkles } from 'lucide-react';
import type { CannedResponseDto } from '@sales-copilot/shared-contracts';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCreateCannedResponse, useUpdateCannedResponse } from './hooks/use-canned-responses';

interface CannedResponseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  responseToEdit?: CannedResponseDto | null;
}

export function CannedResponseFormDialog({
  open,
  onOpenChange,
  workspaceId,
  responseToEdit,
}: CannedResponseFormDialogProps) {
  const isEditing = !!responseToEdit;

  const [shortCode, setShortCode] = React.useState('');
  const [content, setContent] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  const { mutate: createResponse, isPending: isCreating } = useCreateCannedResponse(workspaceId);
  const { mutate: updateResponse, isPending: isUpdating } = useUpdateCannedResponse(workspaceId);

  const isPending = isCreating || isUpdating;

  // Initialize or reset form values
  React.useEffect(() => {
    if (open) {
      if (responseToEdit) {
        setShortCode(responseToEdit.shortCode);
        setContent(responseToEdit.content);
      } else {
        setShortCode('');
        setContent('');
      }
      setTouched(false);
    }
  }, [open, responseToEdit]);

  // Clean shortcode: strip leading slash if typed and lowercase
  const cleanShortCode = shortCode.trim().replace(/^\/+/, '');
  const trimmedContent = content.trim();

  // Validation
  const shortCodeError = React.useMemo(() => {
    if (!touched) return null;
    if (cleanShortCode.length === 0) {
      return 'Shortcode cannot be empty';
    }
    if (cleanShortCode.length > 50) {
      return 'Shortcode must be at most 50 characters';
    }
    if (/\s/.test(cleanShortCode)) {
      return 'Shortcode cannot contain spaces';
    }
    return null;
  }, [cleanShortCode, touched]);

  const contentError = React.useMemo(() => {
    if (!touched) return null;
    if (trimmedContent.length === 0) {
      return 'Content cannot be empty';
    }
    return null;
  }, [trimmedContent, touched]);

  const isValid =
    !shortCodeError && !contentError && cleanShortCode.length > 0 && trimmedContent.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid || isPending) return;

    if (isEditing && responseToEdit) {
      updateResponse(
        {
          id: responseToEdit.id,
          dto: {
            shortCode: cleanShortCode,
            content: trimmedContent,
          },
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    } else {
      createResponse(
        {
          shortCode: cleanShortCode,
          content: trimmedContent,
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <DialogTitle className="text-sm font-semibold">
                {isEditing ? 'Edit Canned Response' : 'Create Canned Response'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              {isEditing
                ? 'Update quick response shortcode and template message.'
                : 'Create reusable response templates that agents can quickly insert into chats.'}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4 py-1">
            {/* Shortcode Field */}
            <Field data-invalid={!!shortCodeError}>
              <FieldLabel htmlFor="canned-shortcode">Shortcode</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold text-primary">
                  /
                </span>
                <Input
                  id="canned-shortcode"
                  value={shortCode}
                  onChange={e => {
                    setShortCode(e.target.value);
                    if (!touched) setTouched(true);
                  }}
                  placeholder="e.g. greeting, pricing, refund_policy"
                  maxLength={50}
                  aria-invalid={!!shortCodeError}
                  required
                  className="pl-6 font-mono text-xs"
                />
              </div>
              <FieldDescription>
                Type{' '}
                <code className="font-mono font-semibold text-primary">
                  /{cleanShortCode || 'shortcode'}
                </code>{' '}
                in any conversation chat composer to quickly insert this response.
              </FieldDescription>
              {shortCodeError && <FieldError errors={[{ message: shortCodeError }]} />}
            </Field>

            {/* Content Field */}
            <Field data-invalid={!!contentError}>
              <FieldLabel htmlFor="canned-content">Message Content</FieldLabel>
              <Textarea
                id="canned-content"
                value={content}
                onChange={e => {
                  setContent(e.target.value);
                  if (!touched) setTouched(true);
                }}
                placeholder="Enter the template text that will be inserted when this shortcode is triggered..."
                rows={5}
                aria-invalid={!!contentError}
                required
                className="text-xs font-sans leading-relaxed"
              />
              {contentError && <FieldError errors={[{ message: contentError }]} />}
            </Field>

            {/* Hint Box */}
            <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
              <span>
                <strong>Tip:</strong> Canned responses help agents reply to common customer
                questions consistently and save time during live conversations.
              </span>
            </div>
          </FieldGroup>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isPending || !cleanShortCode || !trimmedContent}
              className="text-xs font-medium"
            >
              {isPending ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Response'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
