'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import type { NewInboxStage } from '../types';

interface TimelineStepItem {
  stage: NewInboxStage;
  stepNumber: number;
  title: string;
  description: string;
}

const INBOX_TIMELINE_STEPS: TimelineStepItem[] = [
  {
    stage: 'select_channel',
    stepNumber: 1,
    title: 'Chọn kênh',
    description: 'Web Chat, Facebook hoặc Telegram',
  },
  {
    stage: 'channel_flow',
    stepNumber: 2,
    title: 'Cấu hình kết nối',
    description: 'Thông số kỹ thuật & xác thực',
  },
  {
    stage: 'collaborators',
    stepNumber: 3,
    title: 'Phân bổ nhân sự',
    description: 'Chỉ định nhân viên tiếp nhận',
  },
  {
    stage: 'success',
    stepNumber: 4,
    title: 'Sẵn sàng',
    description: 'Hoàn tất & hướng dẫn sử dụng',
  },
];

interface InboxTimelineStepperProps {
  currentStage: NewInboxStage;
  currentStepNumber: number;
  onStepClick?: (stage: NewInboxStage) => void;
  className?: string;
}

export function InboxTimelineStepper({
  currentStepNumber,
  onStepClick,
  className = '',
}: InboxTimelineStepperProps) {
  return (
    <nav aria-label="Tiến trình tạo hộp thư" className={`flex flex-col py-1 ${className}`}>
      {INBOX_TIMELINE_STEPS.map((stepMeta, index) => {
        const isCompleted = currentStepNumber > stepMeta.stepNumber;
        const isCurrent = currentStepNumber === stepMeta.stepNumber;
        const isLast = index === INBOX_TIMELINE_STEPS.length - 1;

        const isClickable =
          currentStepNumber < 4 &&
          ((stepMeta.stepNumber === 1 && currentStepNumber > 1) ||
            (stepMeta.stepNumber === 2 && currentStepNumber === 3)) &&
          !!onStepClick;

        return (
          <div
            key={stepMeta.stage}
            onClick={() => {
              if (isClickable) {
                onStepClick(stepMeta.stage);
              }
            }}
            className={`flex items-start group ${
              isClickable
                ? 'cursor-pointer'
                : isCurrent
                  ? 'cursor-default'
                  : 'cursor-default opacity-85'
            }`}
          >
            {/* Left Column: Step Badge Circle & Connecting Vertical Line */}
            <div className="flex flex-col items-center shrink-0 self-stretch">
              <div
                className={`relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 select-none ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-sm shadow-primary/30'
                    : isCompleted
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500/25 group-hover:border-emerald-500/50'
                      : 'bg-muted/40 text-muted-foreground/70 border border-border/60'
                }`}
              >
                {isCompleted ? (
                  <Check className="size-4 stroke-[2.5] text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <span>{stepMeta.stepNumber}</span>
                )}
              </div>

              {/* Connecting Vertical Line */}
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 min-h-[36px] transition-colors duration-200 ${
                    isCompleted ? 'bg-emerald-500/80' : 'bg-border/70'
                  }`}
                />
              )}
            </div>

            {/* Right Column: Title & Description */}
            <div className="flex flex-col pl-4 pb-7 pt-1 min-w-0">
              <span
                className={`text-sm font-semibold tracking-tight transition-colors duration-200 ${
                  isCurrent
                    ? 'text-primary font-bold'
                    : isCompleted
                      ? 'text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                      : 'text-foreground/80'
                }`}
              >
                {stepMeta.title}
              </span>
              <p
                className={`text-xs mt-1 leading-relaxed transition-colors duration-200 ${
                  isCurrent
                    ? 'text-muted-foreground font-normal'
                    : isCompleted
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/65'
                }`}
              >
                {stepMeta.description}
              </p>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
