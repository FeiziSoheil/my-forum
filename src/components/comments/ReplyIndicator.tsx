'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';

type ReplyIndicatorProps = {
  username: string;
};

export const ReplyIndicator = memo(function ReplyIndicator({ username }: ReplyIndicatorProps) {
  const router = useRouter();

  return (
    <p className="mb-1 text-[13px] leading-snug text-muted-foreground">
      Replying to{' '}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/profile/${username}`);
        }}
        className="min-h-11 text-primary hover:underline sm:min-h-0"
      >
        @{username}
      </button>
    </p>
  );
});
