'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ChannelFlowLayout } from '../../components/channel-flow-layout';
import { useNewInbox } from '../../context/new-inbox-context';
import { telegramChannelSchema, type TelegramFormValues } from './telegram-schema';
import type { ChannelDefinition } from '../../channel-registry';
import Link from 'next/link';

interface TelegramFlowProps {
  channel: ChannelDefinition;
}

export function TelegramFlow({ channel }: TelegramFlowProps) {
  const { submitChannelDraft, isSubmitting, draftConfig } = useNewInbox();

  const defaultValues = React.useMemo(() => {
    if (draftConfig && draftConfig.channelType === ChannelType.TELEGRAM) {
      return {
        name: draftConfig.name || '',
        avatarUrl: draftConfig.avatarUrl || '',
        botToken: (draftConfig.credentials?.botToken as string) || '',
      };
    }
    return {
      name: '',
      avatarUrl: '',
      botToken: '',
    };
  }, [draftConfig]);

  const methods = useForm<TelegramFormValues>({
    resolver: zodResolver(telegramChannelSchema),
    defaultValues,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = methods;

  const onSubmit = (data: TelegramFormValues) => {
    const trimmedToken = data.botToken.trim();
    submitChannelDraft({
      name: data.name?.trim() || '',
      avatarUrl: data.avatarUrl?.trim(),
      credentials: { botToken: trimmedToken },
      providerAccountId: trimmedToken.split(':')[0],
      channelType: ChannelType.TELEGRAM,
    });
  };

  return (
    <FormProvider {...methods}>
      <ChannelFlowLayout
        channel={channel}
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={isSubmitting}
      >
        <Field data-invalid={Boolean(errors.botToken)}>
          <FieldLabel htmlFor="tg-token" className="text-xs font-medium">
            Telegram Bot Token <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="tg-token"
            {...register('botToken')}
            placeholder="123456:ABC-DEF1234ghIkl..."
            className="h-8 text-xs font-mono"
            aria-invalid={Boolean(errors.botToken)}
          />
          {errors.botToken ? (
            <FieldError errors={[errors.botToken]} />
          ) : (
            <FieldDescription className="text-[11px] text-muted-foreground">
              Nhận token bằng cách nhắn tin cho{' '}
              <Link
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-primary underline underline-offset-2 hover:opacity-80"
              >
                @BotFather
              </Link>{' '}
              trên Telegram.
            </FieldDescription>
          )}
        </Field>
      </ChannelFlowLayout>
    </FormProvider>
  );
}
