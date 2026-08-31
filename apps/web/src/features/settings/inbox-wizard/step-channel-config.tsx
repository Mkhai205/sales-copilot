'use client';

import * as React from 'react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { LABEL_PRESET_COLORS, isValidHexColor } from '../constants/label-colors';

export interface ChannelConfigState {
  name: string;
  greetingMessage: string;
  isAutoAssignmentEnabled: boolean;
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
}

interface StepChannelConfigProps {
  channelType: ChannelType;
  config: ChannelConfigState;
  onChange: (config: ChannelConfigState) => void;
  touched: boolean;
}

export function StepChannelConfig({
  channelType,
  config,
  onChange,
  touched,
}: StepChannelConfigProps) {
  const updateConfig = (updates: Partial<ChannelConfigState>) => {
    onChange({
      ...config,
      ...updates,
    });
  };

  const updateCredential = (key: string, value: string) => {
    onChange({
      ...config,
      credentials: {
        ...config.credentials,
        [key]: value,
      },
    });
  };

  const updateSetting = (key: string, value: unknown) => {
    onChange({
      ...config,
      settings: {
        ...config.settings,
        [key]: value,
      },
    });
  };

  const nameError = touched && !config.name.trim() ? 'Inbox name is required' : null;

  return (
    <div className="flex flex-col gap-4 py-1">
      <FieldGroup className="gap-4">
        {/* Inbox Name */}
        <Field data-invalid={!!nameError}>
          <FieldLabel htmlFor="inbox-name">Inbox Name</FieldLabel>
          <Input
            id="inbox-name"
            value={config.name}
            onChange={e => updateConfig({ name: e.target.value })}
            placeholder={
              channelType === ChannelType.WEB_CHAT
                ? 'e.g. Website Live Support'
                : channelType === ChannelType.FACEBOOK_MESSENGER
                  ? 'e.g. Facebook Fanpage'
                  : channelType === ChannelType.TELEGRAM
                    ? 'e.g. Telegram Support Bot'
                    : channelType === ChannelType.EMAIL
                      ? 'e.g. support@company.com'
                      : 'e.g. Zalo OA Official'
            }
            maxLength={100}
            required
            className="text-xs"
          />
          {nameError && <FieldError errors={[{ message: nameError }]} />}
        </Field>

        {/* Greeting Message */}
        <Field>
          <FieldLabel htmlFor="greeting-msg">Greeting Message</FieldLabel>
          <Textarea
            id="greeting-msg"
            value={config.greetingMessage}
            onChange={e => updateConfig({ greetingMessage: e.target.value })}
            placeholder="Welcome message sent automatically when a new conversation starts..."
            rows={2}
            className="text-xs"
          />
          <FieldDescription>
            Optional auto-reply message sent when a customer opens a new conversation.
          </FieldDescription>
        </Field>

        {/* Channel Specific Configuration */}
        {channelType === ChannelType.WEB_CHAT && (
          <>
            <Field>
              <FieldLabel htmlFor="website-url">Website URL</FieldLabel>
              <Input
                id="website-url"
                value={(config.settings.websiteUrl as string) || ''}
                onChange={e => updateSetting('websiteUrl', e.target.value)}
                placeholder="https://example.com"
                className="text-xs"
              />
              <FieldDescription>
                The domain where the chat widget will be deployed.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Widget Brand Color</FieldLabel>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {LABEL_PRESET_COLORS.slice(0, 8).map(preset => {
                  const currentColor = (config.settings.widgetColor as string) || '#2563eb';
                  const isSelected = currentColor.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => updateSetting('widgetColor', preset.hex)}
                      style={{ backgroundColor: preset.hex }}
                      className={`size-6 rounded-md transition-transform hover:scale-105 ${
                        isSelected
                          ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                          : ''
                      }`}
                    />
                  );
                })}
                <Input
                  value={(config.settings.widgetColor as string) || '#2563eb'}
                  onChange={e => {
                    if (isValidHexColor(e.target.value)) {
                      updateSetting('widgetColor', e.target.value);
                    }
                  }}
                  className="h-7 w-24 text-xs font-mono"
                  placeholder="#2563eb"
                />
              </div>
            </Field>
          </>
        )}

        {channelType === ChannelType.FACEBOOK_MESSENGER && (
          <>
            <Field>
              <FieldLabel htmlFor="fb-page-id">Page ID</FieldLabel>
              <Input
                id="fb-page-id"
                value={config.credentials.pageId || ''}
                onChange={e => updateCredential('pageId', e.target.value)}
                placeholder="e.g. 104829104928401"
                className="text-xs font-mono"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="fb-access-token">Page Access Token</FieldLabel>
              <Input
                id="fb-access-token"
                type="password"
                value={config.credentials.pageAccessToken || ''}
                onChange={e => updateCredential('pageAccessToken', e.target.value)}
                placeholder="EAA..."
                className="text-xs font-mono"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="fb-app-secret">App Secret</FieldLabel>
              <Input
                id="fb-app-secret"
                type="password"
                value={config.credentials.appSecret || ''}
                onChange={e => updateCredential('appSecret', e.target.value)}
                placeholder="Your Meta App Secret"
                className="text-xs font-mono"
              />
            </Field>
          </>
        )}

        {channelType === ChannelType.TELEGRAM && (
          <Field>
            <FieldLabel htmlFor="tg-bot-token">Telegram Bot Token</FieldLabel>
            <Input
              id="tg-bot-token"
              type="password"
              value={config.credentials.botToken || ''}
              onChange={e => updateCredential('botToken', e.target.value)}
              placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              className="text-xs font-mono"
            />
            <FieldDescription>
              Obtained from Telegram @BotFather when creating your bot.
            </FieldDescription>
          </Field>
        )}

        {channelType === ChannelType.EMAIL && (
          <>
            <Field>
              <FieldLabel htmlFor="email-addr">Email Address</FieldLabel>
              <Input
                id="email-addr"
                type="email"
                value={config.credentials.emailAddress || ''}
                onChange={e => updateCredential('emailAddress', e.target.value)}
                placeholder="support@company.com"
                className="text-xs"
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="smtp-host">SMTP Host</FieldLabel>
                <Input
                  id="smtp-host"
                  value={config.credentials.smtpHost || ''}
                  onChange={e => updateCredential('smtpHost', e.target.value)}
                  placeholder="smtp.mailgun.org"
                  className="text-xs font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="smtp-port">SMTP Port</FieldLabel>
                <Input
                  id="smtp-port"
                  value={config.credentials.smtpPort || '587'}
                  onChange={e => updateCredential('smtpPort', e.target.value)}
                  placeholder="587"
                  className="text-xs font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="smtp-user">SMTP Username</FieldLabel>
                <Input
                  id="smtp-user"
                  value={config.credentials.smtpUser || ''}
                  onChange={e => updateCredential('smtpUser', e.target.value)}
                  placeholder="postmaster@company.com"
                  className="text-xs font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="smtp-pass">SMTP Password</FieldLabel>
                <Input
                  id="smtp-pass"
                  type="password"
                  value={config.credentials.smtpPassword || ''}
                  onChange={e => updateCredential('smtpPassword', e.target.value)}
                  placeholder="••••••••"
                  className="text-xs font-mono"
                />
              </Field>
            </div>
          </>
        )}

        {channelType === ChannelType.ZALO && (
          <>
            <Field>
              <FieldLabel htmlFor="zalo-oa-id">Zalo OA ID</FieldLabel>
              <Input
                id="zalo-oa-id"
                value={config.credentials.oaId || ''}
                onChange={e => updateCredential('oaId', e.target.value)}
                placeholder="e.g. 293849102948"
                className="text-xs font-mono"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="zalo-app-id">Zalo App ID</FieldLabel>
              <Input
                id="zalo-app-id"
                value={config.credentials.appId || ''}
                onChange={e => updateCredential('appId', e.target.value)}
                placeholder="e.g. 192837465"
                className="text-xs font-mono"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="zalo-secret">Secret Key</FieldLabel>
              <Input
                id="zalo-secret"
                type="password"
                value={config.credentials.secretKey || ''}
                onChange={e => updateCredential('secretKey', e.target.value)}
                placeholder="Secret Key from Zalo Developer"
                className="text-xs font-mono"
              />
            </Field>
          </>
        )}

        {/* Auto Assignment Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-muted/20">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">Auto-assign Conversations</span>
            <span className="text-[11px] text-muted-foreground">
              Automatically distribute new incoming conversations round-robin to assigned agents.
            </span>
          </div>
          <Switch
            checked={config.isAutoAssignmentEnabled}
            onCheckedChange={val => updateConfig({ isAutoAssignmentEnabled: val })}
          />
        </div>
      </FieldGroup>
    </div>
  );
}
