"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/axios";
import {
  ActiveTrigger,
  applyTriggerInsertion,
  detectActiveTrigger,
} from "@/lib/composer/detectTrigger";

export type MentionSuggestion = {
  _id: string;
  username: string;
  fullname?: string;
  avatar?: string;
};

export type AutocompleteItem =
  | { kind: "mention"; user: MentionSuggestion }
  | { kind: "tag"; tag: string };

const DEBOUNCE_MS = 250;

export function useComposerAutocomplete(
  value: string,
  onChange: (next: string) => void
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const [trigger, setTrigger] = useState<ActiveTrigger | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debouncedKind, setDebouncedKind] = useState<
    ActiveTrigger["kind"] | null
  >(null);
  const [items, setItems] = useState<AutocompleteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const fetchIdRef = useRef(0);

  // Restore caret after controlled value updates from a suggestion insert
  useEffect(() => {
    if (pendingCaretRef.current == null) return;
    const el = textareaRef.current;
    const caret = pendingCaretRef.current;
    pendingCaretRef.current = null;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  }, [value]);

  const syncTriggerFromCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const next = detectActiveTrigger(el.value, el.selectionStart ?? 0);
    setTrigger(next);
    setOpen(!!next);
    if (!next) {
      setItems([]);
      setIsLoading(false);
    }
  }, []);

  // Debounce query for API
  useEffect(() => {
    if (!trigger) {
      setDebouncedQuery("");
      setDebouncedKind(null);
      return;
    }
    const t = setTimeout(() => {
      setDebouncedQuery(trigger.query);
      setDebouncedKind(trigger.kind);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [trigger]);

  const queryPending =
    !!trigger &&
    (trigger.kind !== debouncedKind || trigger.query !== debouncedQuery);

  // Fetch suggestions
  useEffect(() => {
    if (!debouncedKind) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    // Mentions require at least 1 char (search API returns [] for empty q)
    if (debouncedKind === "mention" && debouncedQuery.length < 1) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    const id = ++fetchIdRef.current;
    setIsLoading(true);

    (async () => {
      try {
        if (debouncedKind === "mention") {
          const res = await api.get("/users/search", {
            params: { q: debouncedQuery },
          });
          if (id !== fetchIdRef.current) return;
          const users = (res.data.users || []) as MentionSuggestion[];
          setItems(
            users.map((user) => ({ kind: "mention" as const, user }))
          );
        } else {
          const res = await api.get("/tags/suggest", {
            params: { q: debouncedQuery, limit: 10 },
          });
          if (id !== fetchIdRef.current) return;
          const tags = (res.data.tags || []) as string[];
          setItems(tags.map((tag) => ({ kind: "tag" as const, tag })));
        }
        setHighlightedIndex(0);
      } catch {
        if (id !== fetchIdRef.current) return;
        setItems([]);
      } finally {
        if (id === fetchIdRef.current) setIsLoading(false);
      }
    })();
  }, [debouncedKind, debouncedQuery]);

  const close = useCallback(() => {
    setOpen(false);
    setTrigger(null);
    setItems([]);
    setIsLoading(false);
  }, []);

  const selectItem = useCallback(
    (item: AutocompleteItem) => {
      const el = textareaRef.current;
      const active =
        trigger ??
        (el
          ? detectActiveTrigger(el.value, el.selectionStart ?? 0)
          : null);
      if (!active || !el) return;

      const token =
        item.kind === "mention" ? `@${item.user.username}` : `#${item.tag}`;
      const { text: next, caret } = applyTriggerInsertion(
        el.value,
        active,
        token
      );

      pendingCaretRef.current = caret;
      onChange(next);
      close();
    },
    [trigger, onChange, close]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open || !trigger) return;

      const count = items.length;
      const canSelect = count > 0 && !queryPending && !isLoading;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "ArrowDown") {
        if (count === 0) return;
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % count);
        return;
      }

      if (e.key === "ArrowUp") {
        if (count === 0) return;
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + count) % count);
        return;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        if (!canSelect) {
          if (e.key === "Tab") return;
          return;
        }
        e.preventDefault();
        const item = items[highlightedIndex];
        if (item) selectItem(item);
      }
    },
    [
      open,
      trigger,
      items,
      highlightedIndex,
      close,
      selectItem,
      queryPending,
      isLoading,
    ]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      requestAnimationFrame(() => syncTriggerFromCaret());
    },
    [onChange, syncTriggerFromCaret]
  );

  const handleSelect = useCallback(() => {
    syncTriggerFromCaret();
  }, [syncTriggerFromCaret]);

  const handleClick = useCallback(() => {
    syncTriggerFromCaret();
  }, [syncTriggerFromCaret]);

  const showLoading = isLoading || queryPending;

  return {
    textareaRef,
    open: open && !!trigger,
    trigger,
    items: queryPending ? [] : items,
    isLoading: showLoading,
    highlightedIndex,
    setHighlightedIndex,
    selectItem,
    close,
    handleKeyDown,
    handleChange,
    handleSelect,
    handleClick,
  };
}
