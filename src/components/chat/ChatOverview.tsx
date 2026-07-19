"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import {
  useAddGroupMembers,
  useRemoveGroupMember,
  useUpdateGroupTitle,
  useUserSearch,
} from "@/hook/useChat";
import { usePublicProfile } from "@/hook/useFollow";
import { formatLastSeen } from "@/lib/presence/status";
import { ChatUser, Conversation, PresenceStatus } from "@/types/chat";
import {
  Check,
  Loader2,
  LogOut,
  MapPin,
  Palette,
  Pencil,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function memberInitial(user: ChatUser) {
  return (user.fullname || user.username || "?").slice(0, 1).toUpperCase();
}

function DirectOverview({
  otherUser,
  presence,
  onOpenTheme,
}: {
  otherUser: ChatUser;
  presence?: PresenceStatus | null;
  onOpenTheme?: () => void;
}) {
  const { data: profile, isLoading } = usePublicProfile(otherUser.username);

  const presenceLine = presence?.online
    ? "Online"
    : presence
      ? formatLastSeen(presence.lastSeenAt)
      : null;

  const bio = profile?.bio;
  const location = profile?.location;
  const displayName =
    profile?.fullname || otherUser.fullname || otherUser.username;
  const avatar = profile?.avatar || otherUser.avatar;

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6 text-center">
      <Avatar className="size-20">
        <AvatarImage src={avatar || undefined} alt={displayName} />
        <AvatarFallback className="text-2xl">
          {memberInitial(otherUser)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 space-y-1">
        <h3 className="truncate text-lg font-semibold tracking-tight">
          {displayName}
        </h3>
        <p className="text-sm text-muted-foreground">@{otherUser.username}</p>
        {presenceLine ? (
          <p
            className={
              presence?.online
                ? "text-xs text-primary"
                : "text-xs text-muted-foreground"
            }
          >
            {presenceLine}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <Loader2
          size={16}
          className="animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : (
        <>
          {bio ? (
            <p className="max-w-sm text-sm leading-relaxed text-foreground/90">
              {bio}
            </p>
          ) : null}
          {location ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={12} aria-hidden />
              {location}
            </p>
          ) : null}
        </>
      )}

      <Button asChild className="mt-1 w-full max-w-xs rounded-full">
        <Link href={`/profile/${otherUser.username}`}>View profile</Link>
      </Button>

      {onOpenTheme ? (
        <Button
          type="button"
          variant="outline"
          className="w-full max-w-xs justify-center gap-2 rounded-full"
          onClick={onOpenTheme}
        >
          <Palette size={16} aria-hidden />
          Chat theme
        </Button>
      ) : null}
    </div>
  );
}

function GroupOverview({
  conversation,
  onClose,
  onOpenTheme,
}: {
  conversation: Conversation;
  onClose: () => void;
  onOpenTheme?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const myId = user?._id;
  const isAdmin = !!conversation.isAdmin;
  const admins = useMemo(
    () => new Set((conversation.admins ?? []).map(String)),
    [conversation.admins]
  );
  const members = conversation.participants ?? [];
  const memberIds = useMemo(
    () => new Set(members.map((m) => m._id)),
    [members]
  );

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(conversation.title || "");
  const [addingMembers, setAddingMembers] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<ChatUser[]>([]);

  const updateTitle = useUpdateGroupTitle(conversation._id);
  const addMembers = useAddGroupMembers(conversation._id);
  const removeMember = useRemoveGroupMember(conversation._id);
  const { data: searchUsers = [], isFetching } = useUserSearch(debounced);

  useEffect(() => {
    setTitleDraft(conversation.title || "");
  }, [conversation.title]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!addingMembers) {
      setQuery("");
      setDebounced("");
      setSelected([]);
    }
  }, [addingMembers]);

  const memberCount = conversation.memberCount ?? members.length;
  const onlineCount = conversation.onlineCount;
  const subtitle =
    typeof onlineCount === "number" && onlineCount > 0
      ? `${memberCount} members · ${onlineCount} online`
      : `${memberCount} members`;

  const handleSaveTitle = async () => {
    const next = titleDraft.trim();
    if (!next || next === (conversation.title || "")) {
      setEditingTitle(false);
      setTitleDraft(conversation.title || "");
      return;
    }
    try {
      await updateTitle.mutateAsync(next);
      setEditingTitle(false);
      toast.success("Group name updated");
    } catch {
      toast.error("Failed to update group name");
    }
  };

  const toggleSelect = (u: ChatUser) => {
    if (memberIds.has(u._id)) return;
    setSelected((prev) =>
      prev.some((s) => s._id === u._id)
        ? prev.filter((s) => s._id !== u._id)
        : [...prev, u]
    );
  };

  const handleAddMembers = async () => {
    if (selected.length === 0) return;
    try {
      await addMembers.mutateAsync(selected.map((u) => u._id));
      toast.success(
        selected.length === 1 ? "Member added" : "Members added"
      );
      setAddingMembers(false);
    } catch {
      toast.error("Failed to add members");
    }
  };

  const handleLeave = async () => {
    if (!myId) return;
    if (!window.confirm("Leave this group?")) return;
    try {
      await removeMember.mutateAsync(myId);
      onClose();
      toast.success("You left the group");
      router.push("/messages");
    } catch {
      toast.error("Failed to leave group");
    }
  };

  const handleRemove = async (target: ChatUser) => {
    if (!window.confirm(`Remove ${target.fullname || target.username}?`)) return;
    try {
      await removeMember.mutateAsync(target._id);
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const candidates = searchUsers.filter((u) => !memberIds.has(u._id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col items-center gap-3 border-b border-border/40 px-4 py-5 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
          <Users size={28} aria-hidden />
        </div>

        {editingTitle ? (
          <div className="flex w-full max-w-sm items-center gap-2">
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              maxLength={100}
              className="rounded-xl text-center"
              autoFocus
              aria-label="Group name"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSaveTitle();
                if (e.key === "Escape") {
                  setEditingTitle(false);
                  setTitleDraft(conversation.title || "");
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="shrink-0 rounded-full"
              disabled={updateTitle.isPending || !titleDraft.trim()}
              onClick={() => void handleSaveTitle()}
            >
              {updateTitle.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5">
            <h3 className="truncate text-lg font-semibold tracking-tight">
              {conversation.title || "Group"}
            </h3>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Rename group"
              >
                <Pencil size={14} />
              </button>
            ) : null}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{subtitle}</p>

        {isAdmin ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setAddingMembers((v) => !v)}
          >
            <UserPlus size={14} />
            {addingMembers ? "Cancel" : "Add members"}
          </Button>
        ) : null}
      </div>

      {addingMembers ? (
        <div className="shrink-0 border-b border-border/40">
          {selected.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {selected.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => toggleSelect(u)}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-muted/70 pe-2.5 ps-1 text-sm"
                >
                  <Avatar className="size-7">
                    <AvatarImage src={u.avatar || undefined} alt={u.fullname} />
                    <AvatarFallback className="text-[11px]">
                      {memberInitial(u)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[6rem] truncate">
                    {u.fullname || u.username}
                  </span>
                  <X size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="relative px-4 pb-3 pt-2">
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

          <div className="max-h-40 overflow-y-auto px-2 pb-2">
            {debounced.length < 1 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Search to add people
              </p>
            ) : isFetching && candidates.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : candidates.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No users found
              </p>
            ) : (
              candidates.map((u) => {
                const isSelected = selected.some((s) => s._id === u._id);
                return (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => toggleSelect(u)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-muted/50"
                  >
                    <Avatar className="size-9">
                      <AvatarImage src={u.avatar || undefined} alt={u.fullname} />
                      <AvatarFallback>{memberInitial(u)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.fullname}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{u.username}
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

          <div className="border-t border-border/40 p-3">
            <Button
              type="button"
              className="w-full rounded-full"
              disabled={selected.length === 0 || addMembers.isPending}
              onClick={() => void handleAddMembers()}
            >
              {addMembers.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : selected.length === 0 ? (
                "Add members"
              ) : (
                `Add ${selected.length}`
              )}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Members
        </p>
        {members.map((member) => {
          const isMe = member._id === myId;
          const memberIsAdmin = admins.has(member._id);
          return (
            <div
              key={member._id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            >
              <Link
                href={`/profile/${member.username}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onClose}
              >
                <Avatar className="size-10">
                  <AvatarImage
                    src={member.avatar || undefined}
                    alt={member.fullname}
                  />
                  <AvatarFallback>{memberInitial(member)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-start">
                  <p className="truncate text-sm font-medium">
                    {member.fullname || member.username}
                    {isMe ? (
                      <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{member.username}
                  </p>
                </div>
              </Link>

              {memberIsAdmin ? (
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Admin
                </span>
              ) : null}

              {isAdmin && !isMe ? (
                <button
                  type="button"
                  onClick={() => void handleRemove(member)}
                  disabled={removeMember.isPending}
                  className="shrink-0 rounded-full px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  aria-label={`Remove ${member.fullname || member.username}`}
                >
                  Remove
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/50 p-4">
        {onOpenTheme ? (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-2 rounded-full"
            onClick={onOpenTheme}
          >
            <Palette size={16} aria-hidden />
            Chat theme
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={removeMember.isPending}
          onClick={() => void handleLeave()}
        >
          {removeMember.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <LogOut size={16} />
              Leave group
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function ChatOverview({
  conversation,
  open,
  onClose,
  onOpenTheme,
}: {
  conversation?: Conversation | null;
  open: boolean;
  onClose: () => void;
  /** Opens personal chat theme picker (closes overview) */
  onOpenTheme?: () => void;
}) {
  const isGroup = conversation?.type === "group";
  const title = isGroup
    ? conversation?.title || "Group info"
    : conversation?.otherUser?.fullname ||
      conversation?.otherUser?.username ||
      "Chat info";

  const openTheme = onOpenTheme
    ? () => {
        onClose();
        onOpenTheme();
      }
    : undefined;

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

        <SheetHeader className="shrink-0 gap-0 border-b border-border/50 px-4 py-3 pe-12 text-start">
          <SheetTitle className="truncate text-base">
            {isGroup ? "Group info" : "Contact info"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isGroup
              ? `Details and members for ${title}`
              : `Profile overview for ${title}`}
          </SheetDescription>
        </SheetHeader>

        {conversation ? (
          isGroup ? (
            <GroupOverview
              conversation={conversation}
              onClose={onClose}
              onOpenTheme={openTheme}
            />
          ) : conversation.otherUser ? (
            <DirectOverview
              otherUser={conversation.otherUser}
              presence={conversation.otherUserPresence}
              onOpenTheme={openTheme}
            />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Unable to load {title}
            </p>
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
