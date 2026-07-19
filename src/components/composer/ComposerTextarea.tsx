"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  AutocompleteItem,
  useComposerAutocomplete,
} from "@/hook/useComposerAutocomplete";

type ComposerTextareaProps = Omit<
  React.ComponentProps<"textarea">,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

function itemKey(item: AutocompleteItem): string {
  return item.kind === "mention" ? `u:${item.user._id}` : `t:${item.tag}`;
}

function itemLabel(item: AutocompleteItem): string {
  return item.kind === "mention" ? `@${item.user.username}` : `#${item.tag}`;
}

export const ComposerTextarea = React.forwardRef<
  HTMLTextAreaElement,
  ComposerTextareaProps
>(function ComposerTextarea(
  { value, onChange, className, onKeyDown, onBlur, ...props },
  forwardedRef
) {
  const ac = useComposerAutocomplete(value, onChange);
  const listId = React.useId();

  const setRefs = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      ac.textareaRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef, ac.textareaRef]
  );

  const showPanel = ac.open;
  const emptyHint =
    ac.trigger?.kind === "mention"
      ? ac.trigger.query.length < 1
        ? "Type a username…"
        : "No users found"
      : "No tags found";

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={setRefs}
        value={value}
        className={className}
        aria-autocomplete="list"
        aria-controls={showPanel ? listId : undefined}
        aria-expanded={showPanel}
        onChange={ac.handleChange}
        onKeyDown={(e) => {
          ac.handleKeyDown(e);
          onKeyDown?.(e);
        }}
        onSelect={ac.handleSelect}
        onClick={ac.handleClick}
        onBlur={(e) => {
          // Delay so mousedown on a suggestion can fire first
          window.setTimeout(() => ac.close(), 150);
          onBlur?.(e);
        }}
      />

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          {ac.isLoading && ac.items.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Searching…
            </div>
          ) : ac.items.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              {emptyHint}
            </p>
          ) : (
            ac.items.map((item, index) => {
              const active = index === ac.highlightedIndex;
              return (
                <button
                  key={itemKey(item)}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    ac.selectItem(item);
                  }}
                  onMouseEnter={() => ac.setHighlightedIndex(index)}
                >
                  {item.kind === "mention" ? (
                    <>
                      <Avatar className="size-7 shrink-0">
                        <AvatarImage
                          src={item.user.avatar || undefined}
                          alt={item.user.username}
                        />
                        <AvatarFallback className="text-[10px]">
                          {(item.user.fullname || item.user.username)
                            .slice(0, 1)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-foreground">
                          @{item.user.username}
                        </span>
                        {item.user.fullname && (
                          <span className="ms-2 text-muted-foreground">
                            {item.user.fullname}
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium text-primary">
                      {itemLabel(item)}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});
