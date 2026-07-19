"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import {
  chatThemePacks,
  DEFAULT_CHAT_THEME_ID,
  type ChatThemePack,
} from "@/lib/chat/themes";
import { getChatPatternImage } from "@/lib/chat/patterns";
import {
  CHAT_WALLPAPER_BLUR_MAX,
  CHAT_WALLPAPER_BLUR_MIN,
  CHAT_WALLPAPER_DIM_MAX,
  CHAT_WALLPAPER_DIM_MIN,
} from "@/lib/chat/wallpaper";
import { cn } from "@/lib/utils";
import {
  Check,
  ImagePlus,
  Loader2,
  Palette,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

function ThemePreview({
  pack,
  selected,
  onSelect,
}: {
  pack: ChatThemePack;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border text-start transition-[border-color,box-shadow,transform] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary shadow-[0_0_0_1px_var(--primary)]"
          : "border-border/60 hover:border-border hover:shadow-sm active:scale-[0.98]"
      )}
      aria-pressed={selected}
      aria-label={`${pack.name} chat theme`}
    >
      <div
        className="relative flex h-20 flex-col justify-end gap-1.5 px-2.5 pb-2.5 pt-3"
        style={{ background: pack.preview.surface }}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: getChatPatternImage(
              pack.id,
              pack.vars.patternColor
            ),
            backgroundRepeat: "repeat",
            backgroundSize: "90px",
          }}
          aria-hidden
        />
        <div
          className="relative z-[1] ms-auto h-5 w-[62%] rounded-2xl rounded-br-md"
          style={{ background: pack.preview.mine }}
          aria-hidden
        />
        <div
          className="relative z-[1] h-5 w-[55%] rounded-2xl rounded-bl-md"
          style={{ background: pack.preview.theirs }}
          aria-hidden
        />
        {selected ? (
          <span className="absolute end-2 top-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Check size={12} strokeWidth={3} aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5 border-t border-border/40 bg-card px-2.5 py-2">
        <p className="truncate text-sm font-medium leading-tight">{pack.name}</p>
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {pack.description}
        </p>
      </div>
    </button>
  );
}

export default function ChatThemePicker({
  open,
  onClose,
  themeId,
  onSelectTheme,
  hasWallpaper,
  wallpaperUrl,
  blur,
  dim,
  onBlurChange,
  onDimChange,
  onUploadWallpaper,
  onClearWallpaper,
  onResetAll,
  uploading,
  shareEnabled,
  shareLabel,
  onShare,
  sharing,
  followingShared,
  onUseShared,
  readOnly,
  groupAdminHint,
}: {
  open: boolean;
  onClose: () => void;
  themeId: string;
  onSelectTheme: (id: string) => void;
  hasWallpaper: boolean;
  wallpaperUrl: string | null;
  blur: number;
  dim: number;
  onBlurChange: (value: number) => void;
  onDimChange: (value: number) => void;
  onUploadWallpaper: (file: File) => Promise<string | null>;
  onClearWallpaper: () => void | Promise<void>;
  onResetAll: () => void | Promise<void>;
  uploading?: boolean;
  /** Direct peer share invite */
  shareEnabled?: boolean;
  shareLabel?: string;
  onShare?: () => void | Promise<void>;
  sharing?: boolean;
  followingShared?: boolean;
  onUseShared?: () => void | Promise<void>;
  /** Group members: view-only (admin controls the theme) */
  readOnly?: boolean;
  /** Group admin: changes sync to everyone automatically */
  groupAdminHint?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const isCustom =
    themeId !== DEFAULT_CHAT_THEME_ID || hasWallpaper;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const error = await onUploadWallpaper(file);
    if (error) toast.error(error);
    else toast.success("Background updated");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleShare = async () => {
    if (!onShare || shareBusy || sharing) return;
    setShareBusy(true);
    try {
      await onShare();
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[88dvh] w-full max-w-md flex-col gap-0 overflow-hidden rounded-t-2xl border-border/60 p-0 sm:max-w-md"
      >
        <div
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
          aria-hidden
        />

        <SheetHeader className="shrink-0 gap-1 border-b border-border/50 px-4 py-3 pe-12 text-start">
          <SheetTitle className="text-base">Chat theme</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {readOnly
              ? "Group theme is set by an admin."
              : groupAdminHint
                ? "Changes sync to everyone in this group automatically."
                : "Personal look for this chat. You can invite the other person to use the same theme."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div
            className={cn(
              "mb-2.5",
              readOnly && "pointer-events-none opacity-70"
            )}
          >
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Color packs
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {chatThemePacks.map((pack) => (
                <ThemePreview
                  key={pack.id}
                  pack={pack}
                  selected={themeId === pack.id}
                  onSelect={() => {
                    if (readOnly) return;
                    onSelectTheme(pack.id);
                  }}
                />
              ))}
            </div>
          </div>

          <div
            className={cn(
              "mt-6 space-y-3 border-t border-border/50 pt-5",
              readOnly && "pointer-events-none opacity-60"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Custom background
              </p>
              {hasWallpaper ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => void onClearWallpaper()}
                  disabled={uploading}
                >
                  <Trash2 size={13} aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={cn(
                "relative flex w-full overflow-hidden rounded-2xl border border-dashed border-border/70 text-start transition-colors",
                "hover:border-border hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-60"
              )}
            >
              {wallpaperUrl ? (
                <div className="relative h-28 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={wallpaperUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      filter: `blur(${Math.min(blur, 12)}px)`,
                      transform: "scale(1.08)",
                    }}
                  />
                  <div
                    className="absolute inset-0 bg-black"
                    style={{ opacity: dim / 100 }}
                    aria-hidden
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 text-xs font-medium text-white">
                    Tap to change photo
                  </span>
                </div>
              ) : (
                <div className="flex w-full items-center gap-3 px-4 py-5">
                  <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                    {uploading ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden />
                    ) : (
                      <ImagePlus size={18} aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {uploading ? "Processing…" : "Upload from device"}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      JPG, PNG, or WebP · up to 8MB
                    </span>
                  </span>
                </div>
              )}
            </button>

            {hasWallpaper ? (
              <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/20 px-3.5 py-3.5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="chat-wallpaper-blur" className="text-sm">
                      Blur
                    </Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {blur}px
                    </span>
                  </div>
                  <Slider
                    id="chat-wallpaper-blur"
                    min={CHAT_WALLPAPER_BLUR_MIN}
                    max={CHAT_WALLPAPER_BLUR_MAX}
                    step={1}
                    value={[blur]}
                    onValueChange={(v) => onBlurChange(v[0] ?? 0)}
                    aria-label="Background blur"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="chat-wallpaper-dim" className="text-sm">
                      Dim
                    </Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {dim}%
                    </span>
                  </div>
                  <Slider
                    id="chat-wallpaper-dim"
                    min={CHAT_WALLPAPER_DIM_MIN}
                    max={CHAT_WALLPAPER_DIM_MAX}
                    step={1}
                    value={[dim]}
                    onValueChange={(v) => onDimChange(v[0] ?? 0)}
                    aria-label="Background dim"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {shareEnabled || (followingShared === false && onUseShared) ? (
            <div className="mt-6 space-y-2 border-t border-border/50 pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Share
              </p>
              {onUseShared && followingShared === false ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 rounded-full"
                  onClick={() => void onUseShared()}
                  disabled={uploading || shareBusy || sharing}
                >
                  <Palette size={15} aria-hidden />
                  Use shared theme
                </Button>
              ) : null}
              {shareEnabled && onShare ? (
                <Button
                  type="button"
                  className="w-full justify-center gap-2 rounded-full"
                  onClick={() => void handleShare()}
                  disabled={
                    uploading || shareBusy || sharing || !isCustom
                  }
                >
                  {shareBusy || sharing ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden />
                  ) : (
                    <Share2 size={15} aria-hidden />
                  )}
                  {shareLabel || "Share with chat"}
                </Button>
              ) : null}
              {shareEnabled && !isCustom ? (
                <p className="text-center text-[11px] text-muted-foreground">
                  Pick a color pack or upload a background first.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {isCustom && !readOnly ? (
          <div className="shrink-0 border-t border-border/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="ghost"
              className="w-full gap-2 rounded-full text-muted-foreground"
              onClick={() => void onResetAll()}
              disabled={uploading}
            >
              <RotateCcw size={15} aria-hidden />
              Reset to default
            </Button>
          </div>
        ) : (
          <div className="pb-[env(safe-area-inset-bottom)]" />
        )}
      </SheetContent>
    </Sheet>
  );
}
