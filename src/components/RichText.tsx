'use client';

import Link from 'next/link';
import React from 'react';

/** Matches #tags (Unicode) and @mentions (ASCII) after start/whitespace. */
const TOKEN_RE = /(?<=^|\s)(#[\p{L}\p{N}_]+|@[a-zA-Z0-9_]+)/gu;

type RichTextProps = {
  text: string;
  className?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
};

export function RichText({ text, className, dir = 'auto' }: RichTextProps) {
  return (
    <span dir={dir} className={className}>
      {renderRichText(text)}
    </span>
  );
}

export function renderRichText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const token = match[1];
    const index = match.index ?? 0;
    if (!token) continue;

    if (index > lastIndex) {
      nodes.push(
        <React.Fragment key={key++}>{text.slice(lastIndex, index)}</React.Fragment>
      );
    }

    // text-link stays distinct from body text (primary ≈ foreground in light/dark)
    const tokenClassName = 'font-medium text-link hover:underline';

    if (token.startsWith('#')) {
      const slug = token.slice(1).toLowerCase();
      nodes.push(
        <Link
          key={key++}
          href={`/tag/${encodeURIComponent(slug)}`}
          onClick={(e) => e.stopPropagation()}
          className={tokenClassName}
        >
          {token}
        </Link>
      );
    } else {
      const username = token.slice(1);
      nodes.push(
        <Link
          key={key++}
          href={`/profile/${encodeURIComponent(username)}`}
          onClick={(e) => e.stopPropagation()}
          className={tokenClassName}
        >
          {token}
        </Link>
      );
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <React.Fragment key={key++}>{text.slice(lastIndex)}</React.Fragment>
    );
  }

  return nodes;
}
