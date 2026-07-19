'use client';

import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type AnimatedCountProps = {
  value: number;
  className?: string;
  /** Hide when count is 0 (default true) */
  hideZero?: boolean;
};

export function AnimatedCount({ value, className, hideZero = true }: AnimatedCountProps) {
  const prev = useRef(value);
  const direction = value >= prev.current ? 1 : -1;
  prev.current = value;

  if (hideZero && value <= 0) return null;

  return (
    <span
      className={cn(
        'relative inline-flex h-[1.15em] min-w-[0.6em] items-center overflow-hidden tabular-nums',
        className
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 8 * direction, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8 * direction, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
