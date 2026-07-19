"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateGroupConversation,
  useUserSearch,
} from "@/hook/useChat";
import { ChatUser } from "@/types/chat";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function CreateGroupModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"members" | "title">("members");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<ChatUser[]>([]);
  const [title, setTitle] = useState("");
  const { data: users = [], isFetching } = useUserSearch(debounced);
  const createGroup = useCreateGroupConversation();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setStep("members");
      setQuery("");
      setDebounced("");
      setSelected([]);
      setTitle("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectedIds = new Set(selected.map((u) => u._id));
  const canContinue = selected.length >= 2;
  const canCreate = title.trim().length > 0 && selected.length >= 2;

  const toggleUser = (user: ChatUser) => {
    setSelected((prev) => {
      if (prev.some((u) => u._id === user._id)) {
        return prev.filter((u) => u._id !== user._id);
      }
      return [...prev, user];
    });
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      const conversation = await createGroup.mutateAsync({
        title: title.trim(),
        participantIds: selected.map((u) => u._id),
      });
      toast.success("Group created");
      onClose();
      router.push(`/messages/${conversation._id}`);
    } catch {
      toast.error("Could not create group");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="New group"
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl border border-border/60 bg-background shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-muted-foreground" aria-hidden />
            <h2 className="text-base font-semibold">
              {step === "members" ? "New group" : "Group name"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {step === "members" ? (
          <>
            {selected.length > 0 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto overflow-y-hidden border-b border-border/40 px-4 py-3">
                {selected.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => toggleUser(user)}
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-muted/70 pe-2.5 ps-1 text-sm"
                  >
                    <Avatar className="size-7">
                      <AvatarImage
                        src={user.avatar || undefined}
                        alt={user.fullname}
                      />
                      <AvatarFallback className="text-[11px]">
                        {(user.fullname || user.username)
                          .slice(0, 1)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[6rem] truncate leading-none">
                      {user.fullname || user.username}
                    </span>
                    <X size={14} className="shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            <div className="relative px-4 py-3">
              <Search
                size={16}
                className="pointer-events-none absolute start-7 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people..."
                className="rounded-full bg-muted/40 ps-9"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {debounced.length < 1 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Search and select at least 2 people
                </p>
              ) : isFetching && users.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No users found
                </p>
              ) : (
                users.map((user) => {
                  const isSelected = selectedIds.has(user._id);
                  return (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => toggleUser(user)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-muted/50"
                    >
                      <Avatar className="size-10">
                        <AvatarImage
                          src={user.avatar || undefined}
                          alt={user.fullname}
                        />
                        <AvatarFallback>
                          {(user.fullname || user.username)
                            .slice(0, 1)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {user.fullname}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{user.username}
                        </p>
                      </div>
                      <span
                        className={`grid size-5 place-items-center rounded-full border ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected ? <Check size={12} /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-border/50 p-4">
              <Button
                type="button"
                className="w-full rounded-full"
                disabled={!canContinue}
                onClick={() => setStep("title")}
              >
                Next ({selected.length} selected)
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4 px-4 py-5">
              <div className="flex flex-wrap gap-1.5">
                {selected.map((user) => (
                  <span
                    key={user._id}
                    className="rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {user.fullname || user.username}
                  </span>
                ))}
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Group name"
                maxLength={100}
                className="rounded-xl"
                autoFocus
              />
            </div>
            <div className="flex gap-2 border-t border-border/50 p-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => setStep("members")}
                disabled={createGroup.isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-full"
                disabled={!canCreate || createGroup.isPending}
                onClick={() => void handleCreate()}
              >
                {createGroup.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
