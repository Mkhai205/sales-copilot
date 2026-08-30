'use client';

import * as React from 'react';
import { X, Mail, Phone, Tag, User, Shield, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface DetailPanelPlaceholderProps {
  onClose: () => void;
}

export function DetailPanelPlaceholder({ onClose }: DetailPanelPlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card/40">
      {/* Detail Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4">
        <h3 className="text-xs font-semibold tracking-tight text-foreground">
          Contact & Conversation Details
        </h3>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          <span className="sr-only">Close detail panel</span>
        </Button>
      </div>

      {/* Detail Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Contact Overview */}
        <div className="flex flex-col items-center text-center space-y-2 pb-2">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary text-base font-bold">
            SC
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Sarah Connor</h4>
            <p className="text-xs text-muted-foreground">Telegram Contact</p>
          </div>
        </div>

        <Separator className="bg-border/60" />

        {/* Contact Attributes */}
        <div className="space-y-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Contact Information
          </h5>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5 text-primary shrink-0" />
              <span className="truncate text-foreground">sarah.connor@cyberdyne.io</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-3.5 text-primary shrink-0" />
              <span className="truncate text-foreground">+1 (555) 019-2834</span>
            </div>
          </div>
        </div>

        <Separator className="bg-border/60" />

        {/* Conversation Attributes */}
        <div className="space-y-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Conversation Attributes
          </h5>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10 py-0 px-1.5 font-medium"
              >
                Open
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Priority</span>
              <Badge
                variant="outline"
                className="text-[10px] text-rose-500 border-rose-500/30 bg-rose-500/10 py-0 px-1.5 font-medium"
              >
                Urgent
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assignee</span>
              <span className="font-medium text-foreground">Alex Agent</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Team</span>
              <span className="font-medium text-foreground">Customer Support</span>
            </div>
          </div>
        </div>

        <Separator className="bg-border/60" />

        {/* Labels Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Labels
            </h5>
            <Button variant="ghost" size="xs" className="h-5 text-[10px] text-primary">
              + Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
              VIP Customer
            </Badge>
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
              Order Inquiry
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
