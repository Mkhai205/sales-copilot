'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ChannelFlowLayout } from '../../components/channel-flow-layout';
import { useNewInbox } from '../../context/new-inbox-context';
import { webChatChannelSchema, type WebChatFormValues } from './web-chat-schema';
import type { ChannelDefinition } from '../../channel-registry';

interface WebChatFlowProps {
  channel: ChannelDefinition;
}

export function WebChatFlow({ channel }: WebChatFlowProps) {
  const { submitChannelDraft, isSubmitting, draftConfig } = useNewInbox();

  const defaultValues = React.useMemo(() => {
    if (draftConfig && draftConfig.channelType === ChannelType.WEB_CHAT) {
      return {
        name: draftConfig.name || '',
        avatarUrl: draftConfig.avatarUrl || '',
        websiteUrl: (draftConfig.credentials?.websiteUrl as string) || '',
      };
    }
    return {
      name: '',
      avatarUrl: '',
      websiteUrl: '',
    };
  }, [draftConfig]);

  const methods = useForm<WebChatFormValues>({
    resolver: zodResolver(webChatChannelSchema),
    defaultValues,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = methods;

  const onSubmit = (data: WebChatFormValues) => {
    submitChannelDraft({
      name: data.name?.trim() || '',
      avatarUrl: data.avatarUrl?.trim(),
      credentials: { websiteUrl: data.websiteUrl?.trim() || '' },
      channelType: ChannelType.WEB_CHAT,
    });
  };

  return (
    <FormProvider {...methods}>
      <ChannelFlowLayout
        channel={channel}
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={isSubmitting}
      >
        <Field data-invalid={Boolean(errors.websiteUrl)}>
          <FieldLabel htmlFor="webchat-domain" className="text-xs font-medium">
            Tên miền / URL Website (Tùy chọn)
          </FieldLabel>
          <Input
            id="webchat-domain"
            {...register('websiteUrl')}
            placeholder="https://myshop.vn"
            className="h-8 text-xs font-mono"
            aria-invalid={Boolean(errors.websiteUrl)}
          />
          {errors.websiteUrl ? (
            <FieldError errors={[errors.websiteUrl]} />
          ) : (
            <FieldDescription className="text-[11px] text-muted-foreground">
              Tên miền chính của website bạn muốn nhúng widget live chat.
            </FieldDescription>
          )}
        </Field>
      </ChannelFlowLayout>
    </FormProvider>
  );
}
