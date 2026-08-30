'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';
import { workspacesApi } from '@/lib/api/workspaces';
import { createWorkspaceSchema } from '@sales-copilot/shared-contracts';

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

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setIsSlugManuallyEdited(false);
      setError(null);
    }
  }, [open]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value);
    setIsSlugManuallyEdited(true);
  };

  const mutation = useMutation({
    mutationFn: async (payload: { name: string; slug: string }) => {
      const res = await workspacesApi.create(payload);
      return res.data;
    },
    onSuccess: newWorkspace => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      onOpenChange(false);
      router.push(`/${newWorkspace.slug}/conversations`);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create workspace');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = createWorkspaceSchema.safeParse({
      name: name.trim(),
      slug: slug.trim() || undefined,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message;
      setError(firstError || 'Please fill in valid workspace details');
      return;
    }

    mutation.mutate({
      name: name.trim(),
      slug: slug.trim() || slugify(name.trim()),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Create Workspace</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set up a new workspace for your team or organization.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-md bg-destructive/15 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="workspace-name" className="text-xs font-medium">
              Workspace Name
            </Label>
            <Input
              id="workspace-name"
              placeholder="e.g. Acme Corp"
              value={name}
              onChange={handleNameChange}
              disabled={mutation.isPending}
              autoFocus
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspace-slug" className="text-xs font-medium">
              Workspace URL Slug
            </Label>
            <div className="flex items-center rounded-md border bg-muted/30 px-2.5 focus-within:ring-1 focus-within:ring-ring">
              <span className="text-xs text-muted-foreground select-none">salescopilot.io/</span>
              <input
                id="workspace-slug"
                placeholder="acme-corp"
                value={slug}
                onChange={handleSlugChange}
                disabled={mutation.isPending}
                className="flex-1 bg-transparent py-1.5 pl-0.5 text-xs outline-none"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Create Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
