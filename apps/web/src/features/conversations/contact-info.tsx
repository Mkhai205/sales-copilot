'use client';

import * as React from 'react';
import { Mail, Phone, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ContactDto } from '@/lib/api/types';

interface ContactInfoProps {
  contact?: ContactDto | null;
  workspaceSlug?: string;
  conversationId?: string;
}

export function ContactInfo({ contact }: ContactInfoProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const contactName = contact?.name || 'Anonymous Visitor';
  const initials = contactName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const customAttrs = contact?.customAttributes
    ? Object.entries(contact.customAttributes).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
      )
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Contact Profile Header */}
      <div className="flex flex-col items-center text-center gap-2 pb-1">
        <Avatar className="size-14 ring-2 ring-border/60 shadow-xs">
          <AvatarImage
            src={contact?.avatarUrl || '/avatar-contact-default.svg'}
            alt={contactName}
          />
          <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 max-w-full">
          <h4 className="truncate text-sm font-semibold text-foreground">{contactName}</h4>
          <p className="truncate text-xs text-muted-foreground">
            {contact?.email || contact?.phoneNumber || 'Customer Profile'}
          </p>
        </div>
      </div>

      {/* Contact Details List */}
      <div className="flex flex-col gap-2.5">
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Contact Details
        </h5>

        {/* Email */}
        {contact?.email ? (
          <div className="group flex items-center justify-between rounded-md p-1.5 hover:bg-muted/40 transition-colors text-xs">
            <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
              <Mail className="size-3.5 text-primary shrink-0" />
              <a
                href={`mailto:${contact.email}`}
                className="truncate text-foreground hover:underline"
              >
                {contact.email}
              </a>
            </div>
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleCopy(contact.email!, 'Email')}
                    className="size-6 text-muted-foreground hover:text-foreground"
                  >
                    {copiedField === 'Email' ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span className="sr-only">Copy email</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Copy email</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70 px-1.5">
            <Mail className="size-3.5 text-muted-foreground/50 shrink-0" />
            <span className="italic">No email provided</span>
          </div>
        )}

        {/* Phone */}
        {contact?.phoneNumber ? (
          <div className="group flex items-center justify-between rounded-md p-1.5 hover:bg-muted/40 transition-colors text-xs">
            <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
              <Phone className="size-3.5 text-primary shrink-0" />
              <a
                href={`tel:${contact.phoneNumber}`}
                className="truncate text-foreground hover:underline"
              >
                {contact.phoneNumber}
              </a>
            </div>
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleCopy(contact.phoneNumber!, 'Phone')}
                    className="size-6 text-muted-foreground hover:text-foreground"
                  >
                    {copiedField === 'Phone' ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span className="sr-only">Copy phone</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Copy phone</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70 px-1.5">
            <Phone className="size-3.5 text-muted-foreground/50 shrink-0" />
            <span className="italic">No phone provided</span>
          </div>
        )}
      </div>

      {/* Custom Attributes */}
      {customAttrs.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Custom Attributes
          </h5>
          <div className="rounded-md border border-border/50 bg-card/50 divide-y divide-border/40 text-xs">
            {customAttrs.map(([key, val]) => (
              <div key={key} className="flex items-center justify-between p-2">
                <span className="text-muted-foreground font-medium">{key}</span>
                <span className="text-foreground truncate max-w-[140px]">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
