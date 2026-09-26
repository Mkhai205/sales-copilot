'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FlowButton } from '@/components/ui/flow-button';

const containerVariants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.43, 0.13, 0.23, 0.96] as const,
      delayChildren: 0.1,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.43, 0.13, 0.23, 0.96] as const,
    },
  },
};

const numberVariants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: direction * 40,
    y: 15,
    rotate: direction * 5,
  }),
  visible: {
    opacity: 0.75,
    x: 0,
    y: 0,
    rotate: 0,
    transition: {
      duration: 0.8,
      ease: [0.43, 0.13, 0.23, 0.96] as const,
    },
  },
};

const ghostVariants = {
  hidden: {
    scale: 0.8,
    opacity: 0,
    y: 15,
    rotate: -5,
  },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: {
      duration: 0.6,
      ease: [0.43, 0.13, 0.23, 0.96] as const,
    },
  },
  hover: {
    scale: 1.1,
    y: -10,
    rotate: [0, -5, 5, -5, 0],
    transition: {
      duration: 0.8,
      ease: 'easeInOut' as const,
      rotate: {
        duration: 2,
        ease: 'linear' as const,
        repeat: Infinity,
        repeatType: 'reverse' as const,
      },
    },
  },
  floating: {
    y: [-5, 5],
    transition: {
      y: {
        duration: 2,
        ease: 'easeInOut' as const,
        repeat: Infinity,
        repeatType: 'reverse' as const,
      },
    },
  },
};

interface GhostNotFoundProps {
  homeHref?: string;
  homeText?: string;
  title?: string;
  subtitle?: string;
}

export function GhostNotFound({
  homeHref = '/',
  homeText = 'Find shelter',
  title = 'Boo! Page missing!',
  subtitle = "Whoops! This page must be a ghost - it's not here!",
}: GhostNotFoundProps) {
  const [showExplanation, setShowExplanation] = React.useState(false);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground px-4 selection:bg-foreground/10 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          className="text-center max-w-lg w-full z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* 4 [Ghost] 4 */}
          <div className="flex items-center justify-center gap-4 md:gap-6 mb-8 md:mb-12">
            <motion.span
              className="text-[80px] md:text-[120px] font-bold text-foreground opacity-70 select-none tracking-tighter"
              variants={numberVariants}
              custom={-1}
            >
              4
            </motion.span>
            <motion.div
              variants={ghostVariants}
              whileHover="hover"
              animate={['visible', 'floating']}
              className="cursor-pointer drop-shadow-md select-none"
            >
              <Image
                src="/ghost.png"
                alt="Ghost"
                width={120}
                height={120}
                className="w-[80px] h-[80px] md:w-[120px] md:h-[120px] object-contain select-none pointer-events-none"
                draggable={false}
                priority
              />
            </motion.div>
            <motion.span
              className="text-[80px] md:text-[120px] font-bold text-foreground opacity-70 select-none tracking-tighter"
              variants={numberVariants}
              custom={1}
            >
              4
            </motion.span>
          </div>

          {/* Heading */}
          <motion.h1
            className="text-3xl md:text-5xl font-bold text-foreground mb-4 md:mb-6 opacity-85 select-none tracking-tight"
            variants={itemVariants}
          >
            {title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-base md:text-xl text-muted-foreground mb-8 md:mb-12 opacity-80 select-none leading-relaxed"
            variants={itemVariants}
          >
            {subtitle}
          </motion.p>

          {/* Flow Button */}
          <motion.div
            variants={itemVariants}
            whileHover={{
              scale: 1.05,
              transition: {
                duration: 0.3,
                ease: [0.43, 0.13, 0.23, 0.96] as const,
              },
            }}
            className="flex justify-center"
          >
            <Link href={homeHref}>
              <FlowButton text={homeText} />
            </Link>
          </motion.div>

          {/* Footer 404 explainer */}
          <motion.div className="mt-12 flex flex-col items-center gap-2" variants={itemVariants}>
            <button
              type="button"
              onClick={() => setShowExplanation(prev => !prev)}
              className="text-xs text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity underline cursor-pointer select-none"
            >
              What means 404?
            </button>
            {showExplanation && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-xs text-muted-foreground max-w-sm px-4 py-2 rounded-md bg-muted/40 border border-border/50 text-center"
              >
                Mã lỗi HTTP 404 cho biết máy chủ không thể tìm thấy tài nguyên theo địa chỉ URL được
                yêu cầu. Trang có thể đã bị di dời hoặc xóa.
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export { GhostNotFound as NotFound };
