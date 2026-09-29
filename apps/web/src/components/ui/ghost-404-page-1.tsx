'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FlowButton } from '@/components/ui/flow-button';

interface GhostNotFoundProps {
  homeHref?: string;
  homeText?: string;
  title?: string;
  subtitle?: string;
}

export function GhostNotFound({
  homeHref = '/',
  homeText = 'Về trang chủ',
  title = 'Hư ảo! Trang này biến mất rồi!',
  subtitle = 'Rất tiếc! Trang này chỉ là bóng ma — nó không tồn tại ở đâu cả!',
}: GhostNotFoundProps) {
  const [showExplanation, setShowExplanation] = React.useState(false);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground px-4 selection:bg-foreground/10 overflow-hidden">
      <div className="text-center max-w-lg w-full z-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
        {/* 4 [Ghost] 4 */}
        <div className="flex items-center justify-center gap-4 md:gap-6 mb-8 md:mb-12">
          <span className="text-[80px] md:text-[120px] font-bold text-foreground opacity-70 select-none tracking-tighter animate-in fade-in slide-in-from-left-8 duration-700">
            4
          </span>
          <div className="cursor-pointer drop-shadow-md select-none transition-transform duration-500 ease-out hover:scale-110 hover:-translate-y-2 animate-in fade-in zoom-in-95 duration-700">
            <Image
              src="/ghost.png"
              alt="Ghost"
              width={120}
              height={120}
              className="w-[80px] h-[80px] md:w-[120px] md:h-[120px] object-contain select-none pointer-events-none"
              draggable={false}
              priority
            />
          </div>
          <span className="text-[80px] md:text-[120px] font-bold text-foreground opacity-70 select-none tracking-tighter animate-in fade-in slide-in-from-right-8 duration-700">
            4
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 md:mb-6 opacity-85 select-none tracking-tight">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-xl text-muted-foreground mb-8 md:mb-12 opacity-80 select-none leading-relaxed">
          {subtitle}
        </p>

        {/* Flow Button */}
        <div className="flex justify-center transition-transform duration-300 hover:scale-105">
          <Link href={homeHref}>
            <FlowButton text={homeText} />
          </Link>
        </div>

        {/* Footer 404 explainer */}
        <div className="mt-12 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExplanation(prev => !prev)}
            className="text-xs text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity underline cursor-pointer select-none"
          >
            What means 404?
          </button>
          {showExplanation && (
            <p className="text-xs text-muted-foreground max-w-sm px-4 py-2 rounded-md bg-muted/40 border border-border/50 text-center animate-in fade-in slide-in-from-top-2 duration-300">
              Mã lỗi HTTP 404 cho biết máy chủ không thể tìm thấy tài nguyên theo địa chỉ URL được
              yêu cầu. Trang có thể đã bị di dời hoặc xóa.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export { GhostNotFound as NotFound };
