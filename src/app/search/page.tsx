'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Hash, Loader2, Search, Users, Feather } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostCard } from '@/components/PostCard';
import SuggestedPeople from '@/components/SuggestedPeople';
import { usePosts } from '@/hook/usePosts';
import { useSearchTags, useSearchUsers } from '@/hook/useSearch';
import { Post } from '@/types/post';
import { ChatUser } from '@/types/chat';

type SearchTab = 'users' | 'tags' | 'posts';

function isSearchTab(value: string | null): value is SearchTab {
  return value === 'users' || value === 'tags' || value === 'posts';
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialTab = searchParams.get('tab');

  const [query, setQuery] = useState(initialQ);
  const [debounced, setDebounced] = useState(initialQ.trim());
  const [tab, setTab] = useState<SearchTab>(
    isSearchTab(initialTab) ? initialTab : 'users'
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debounced) params.set('q', debounced);
    if (tab !== 'users') params.set('tab', tab);
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  }, [debounced, tab, router]);

  const hasQuery = debounced.length >= 1;

  const {
    data: users = [],
    isFetching: usersFetching,
    isLoading: usersLoading,
  } = useSearchUsers(debounced, hasQuery && tab === 'users');

  const {
    data: tags = [],
    isFetching: tagsFetching,
    isLoading: tagsLoading,
  } = useSearchTags(debounced, tab === 'tags');

  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
    isFetching: postsFetching,
  } = usePosts({
    q: debounced,
    enabled: hasQuery && tab === 'posts',
  });

  const posts = useMemo(
    () => postsData?.pages.flatMap((page) => page.posts) ?? [],
    [postsData]
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab !== 'posts') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [tab, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const showUsersSpinner = usersLoading || (usersFetching && users.length === 0);
  const showTagsSpinner = tagsLoading || (tagsFetching && tags.length === 0);
  const showPostsSpinner = postsLoading || (postsFetching && posts.length === 0);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-32 pt-4 lg:max-w-2xl lg:pb-10 xl:max-w-3xl">
      <div className="relative mb-4">
        <Search
          size={16}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users, tags, posts..."
          className="rounded-full bg-muted/40 ps-9"
          autoFocus
          aria-label="Search"
        />
        {(usersFetching || tagsFetching || postsFetching) && (
          <Loader2
            size={14}
            className="absolute end-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isSearchTab(value)) setTab(value);
        }}
        className="gap-3"
      >
        <TabsList className="grid w-full grid-cols-3 rounded-full bg-muted/50 p-1">
          <TabsTrigger value="users" className="rounded-full">
            Users
          </TabsTrigger>
          <TabsTrigger value="tags" className="rounded-full">
            Tags
          </TabsTrigger>
          <TabsTrigger value="posts" className="rounded-full">
            Posts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-1">
          {!hasQuery ? (
            <SuggestedPeople limit={8} className="mt-1" showSeeMore={false} />
          ) : showUsersSpinner ? (
            <CenteredSpinner />
          ) : users.length === 0 ? (
            <EmptyHint
              icon={Users}
              title="No users found"
              description={`Nothing matched “${debounced}”.`}
            />
          ) : (
            <div className="divide-y divide-border/60">
              {users.map((user) => (
                <UserResultRow key={user._id} user={user} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tags" className="mt-1">
          {showTagsSpinner ? (
            <CenteredSpinner />
          ) : tags.length === 0 ? (
            <EmptyHint
              icon={Hash}
              title={hasQuery ? 'No tags found' : 'No popular tags yet'}
              description={
                hasQuery
                  ? `Nothing matched “${debounced}”.`
                  : 'Tags appear as people post with #hashtags.'
              }
            />
          ) : (
            <div>
              {!hasQuery && (
                <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Popular tags
                </p>
              )}
              <div className="divide-y divide-border/60">
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/tag/${encodeURIComponent(tag)}`}
                    className="flex items-center gap-3 px-1 py-3 transition-colors hover:bg-muted/30"
                  >
                    <span className="grid size-11 place-items-center rounded-full bg-muted/60">
                      <Hash className="size-5 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" dir="auto">
                        #{tag}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        View posts with this tag
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="posts" className="mt-1">
          {!hasQuery ? (
            <EmptyHint
              icon={Feather}
              title="Search posts"
              description="Find posts by words in their content."
            />
          ) : showPostsSpinner ? (
            <CenteredSpinner />
          ) : posts.length === 0 ? (
            <EmptyHint
              icon={Feather}
              title="No posts found"
              description={`Nothing matched “${debounced}”.`}
            />
          ) : (
            <>
              <div className="divide-y divide-border/60">
                {posts.map((post: Post, index: number) => (
                  <PostCard
                    key={post._id ?? index}
                    post={post}
                    onReply={(postId) => router.push(`/post/${postId}/reply`)}
                  />
                ))}
              </div>
              <div
                ref={loadMoreRef}
                className="flex items-center justify-center py-8"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : hasNextPage ? (
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    className="rounded-full border border-border bg-muted/40 px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Load more
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    End of results
                  </span>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function UserResultRow({ user }: { user: ChatUser }) {
  return (
    <Link
      href={`/profile/${user.username}`}
      className="flex items-center gap-3 px-1 py-3 transition-colors hover:bg-muted/30"
    >
      <Avatar className="size-11">
        <AvatarImage src={user.avatar || undefined} alt={user.fullname} />
        <AvatarFallback>
          {(user.fullname || user.username).slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {user.fullname}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          @{user.username}
        </p>
      </div>
    </Link>
  );
}

function EmptyHint({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted/60">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function CenteredSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-xl items-center justify-center px-4 py-16 lg:max-w-2xl xl:max-w-3xl">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
