"use client";

import { useEffect, useState } from "react";
import { ChatUser } from "@/types/chat";
import { useStartConversation, useUserSearch } from "@/hook/useChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function UserSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const { data: users = [], isFetching } = useUserSearch(debounced);
  const startConversation = useStartConversation();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleSelect = async (user: ChatUser) => {
    try {
      const conversation = await startConversation.mutateAsync(user._id);
      setQuery("");
      router.push(`/messages/${conversation._id}`);
    } catch {
      toast.error("Could not start conversation");
    }
  };

  return (
    <div className="relative px-4 pt-3 pb-2">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users to chat..."
          className="rounded-full bg-muted/40 ps-9"
        />
        {isFetching && (
          <Loader2
            size={14}
            className="absolute end-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>

      {debounced.length >= 1 && (
        <div className="absolute inset-x-4 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-border/60 bg-background shadow-lg">
          {users.length === 0 && !isFetching ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No users found
            </p>
          ) : (
            users.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => handleSelect(user)}
                disabled={startConversation.isPending}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                <Avatar className="size-9">
                  <AvatarImage src={user.avatar || undefined} alt={user.fullname} />
                  <AvatarFallback>
                    {(user.fullname || user.username).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.fullname}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{user.username}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
