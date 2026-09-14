'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

export interface WizardStepMeta {
  step: number;
  title: string;
  description: string;
}

export const INBOX_WIZARD_STEPS: WizardStepMeta[] = [
  {
    step: 1,
    title: 'Chọn kênh',
    description: 'Chọn nhà cung cấp bạn muốn tích hợp với Sales Copilot.',
  },
  {
    step: 2,
    title: 'Tạo Hộp thư đến',
    description: 'Xác thực tài khoản của bạn và tạo hộp thư đến.',
  },
  {
    step: 3,
    title: 'Thêm nhân viên',
    description: 'Thêm nhân viên vào hộp thư đến đã tạo.',
  },
  {
    step: 4,
    title: 'Hoàn thành cấu hình',
    description: 'Bạn đã sẵn sàng để bắt đầu tiếp nhận tin nhắn!',
  },
];

interface InboxVerticalStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function InboxVerticalStepper({
  currentStep,
  onStepClick,
  className = '',
}: InboxVerticalStepperProps) {
  return (
    <div className={`flex flex-col py-1 ${className}`}>
      {INBOX_WIZARD_STEPS.map((stepMeta, index) => {
        const isCompleted = currentStep > stepMeta.step;
        const isCurrent = currentStep === stepMeta.step;
        const isLast = index === INBOX_WIZARD_STEPS.length - 1;

        const isClickable = isCompleted && !!onStepClick;

        return (
          <div
            key={stepMeta.step}
            onClick={() => {
              if (isClickable) {
                onStepClick(stepMeta.step);
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
            {/* Left Column: Step Badge Circle & Connecting Line */}
            <div className="flex flex-col items-center shrink-0 self-stretch">
              <div
                className={`relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-4 ring-blue-600/20 shadow-sm shadow-blue-600/30'
                    : isCompleted
                      ? 'bg-blue-600/15 text-blue-500 border border-blue-600/30 group-hover:bg-blue-600/25 group-hover:border-blue-600/50'
                      : 'bg-muted/40 text-muted-foreground/70 border border-border/60'
                }`}
              >
                {isCompleted ? (
                  <Check className="size-4 stroke-[2.5]" />
                ) : (
                  <span>{stepMeta.step}</span>
                )}
              </div>

              {/* Connecting Vertical Line */}
              {!isLast && (
                <div
                  className={`w-0.5 my-1 flex-1 min-h-[36px] transition-colors duration-200 ${
                    isCompleted ? 'bg-blue-600/80' : 'bg-border/70'
                  }`}
                />
              )}
            </div>

            {/* Right Column: Title & Description */}
            <div className="flex flex-col pl-4 pb-7 pt-1 min-w-0">
              <span
                className={`text-sm font-semibold tracking-tight transition-colors duration-200 ${
                  isCurrent
                    ? 'text-blue-500 font-bold'
                    : isCompleted
                      ? 'text-foreground group-hover:text-blue-500'
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
    </div>
  );
}
