import { api } from "@/lib/api/axios"
import { Post } from "@/types/post"
import { InfiniteData, QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

interface PostsPage {
    posts: Post[]
    hasMore: boolean
    nextCursor?: string
}

export const toggleLikeState = <T extends { isLiked?: boolean; likesCount: number }>(item: T, wasLiked: boolean): T => ({
    ...item,
    isLiked: !wasLiked,
    likesCount: Math.max(0, (item.likesCount ?? 0) + (wasLiked ? -1 : 1)),
})

export const toggleRepostState = <T extends { isReposted?: boolean; repostsCount: number }>(item: T, wasReposted: boolean): T => ({
    ...item,
    isReposted: !wasReposted,
    repostsCount: Math.max(0, (item.repostsCount ?? 0) + (wasReposted ? -1 : 1)),
})

export function applyPollVoteState(post: Post, optionId: string): Post {
    if (!post.poll) return post
    const prev = post.myVoteOptionId ?? null
    if (prev === optionId) return post

    const options = post.poll.options.map((o) => {
        let votesCount = o.votesCount
        if (prev && o.id === prev) votesCount = Math.max(0, votesCount - 1)
        if (o.id === optionId) votesCount += 1
        return { ...o, votesCount }
    })

    return {
        ...post,
        myVoteOptionId: optionId,
        poll: {
            ...post.poll,
            options,
            votesCount: prev ? post.poll.votesCount : post.poll.votesCount + 1,
        },
    }
}

const PROFILE_POST_KEY_PREFIXES = ['user-posts', 'user-reposts'] as const

function getProfilePostQueryKeys(queryClient: QueryClient) {
    return queryClient
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey)
        .filter(
            (k): k is readonly unknown[] =>
                Array.isArray(k) &&
                typeof k[0] === 'string' &&
                (PROFILE_POST_KEY_PREFIXES as readonly string[]).includes(k[0])
        )
}

function snapshotProfilePostCaches(queryClient: QueryClient) {
    return getProfilePostQueryKeys(queryClient).map((key) => ({
        key,
        data: queryClient.getQueryData<Post[]>(key),
    }))
}

function updatePostInProfileCaches(
    queryClient: QueryClient,
    postId: string,
    updater: (post: Post) => Post
) {
    for (const key of getProfilePostQueryKeys(queryClient)) {
        queryClient.setQueryData<Post[]>(key, (old) => {
            if (!old) return old
            return old.map((p) => (p._id === postId ? updater(p) : p))
        })
    }
}

/** Pin/unpin in profile lists: enforce single pin + sort pinned posts first. */
function applyPinInProfileCaches(
    queryClient: QueryClient,
    postId: string,
    nextPinned: boolean
) {
    for (const key of getProfilePostQueryKeys(queryClient)) {
        queryClient.setQueryData<Post[]>(key, (old) => {
            if (!old) return old
            const updated = old.map((p) => {
                if (p._id === postId) {
                    return {
                        ...p,
                        isPinned: nextPinned,
                        pinnedAt: nextPinned ? new Date() : undefined,
                    }
                }
                if (nextPinned && p.isPinned) {
                    return { ...p, isPinned: false, pinnedAt: undefined }
                }
                return p
            })
            return [...updated].sort((a, b) => {
                if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1
                if (a.isPinned && b.isPinned) {
                    const ta = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
                    const tb = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
                    if (ta !== tb) return tb - ta
                }
                return b._id > a._id ? 1 : b._id < a._id ? -1 : 0
            })
        })
    }
}

function restoreProfilePostCaches(
    queryClient: QueryClient,
    snapshots: Array<{ key: readonly unknown[]; data: Post[] | undefined }>
) {
    for (const { key, data } of snapshots) {
        queryClient.setQueryData(key, data)
    }
}

function invalidateProfilePostCaches(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: ['user-posts'] })
    queryClient.invalidateQueries({ queryKey: ['user-reposts'] })
}

function mapPostInInfiniteData(
    old: InfiniteData<PostsPage> | undefined,
    postId: string,
    updater: (post: Post) => Post
): InfiniteData<PostsPage> | undefined {
    if (!old) return old
    return {
        ...old,
        pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) => (p._id === postId ? updater(p) : p)),
        })),
    }
}

/** Updates every infinite feed whose key starts with `queryKey` (e.g. all `posts` variants). */
function updatePostInInfiniteCaches(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    postId: string,
    updater: (post: Post) => Post
) {
    queryClient.setQueriesData<InfiniteData<PostsPage>>({ queryKey }, (old) =>
        mapPostInInfiniteData(old, postId, updater)
    )
}

function snapshotInfiniteCaches(queryClient: QueryClient, queryKey: readonly unknown[]) {
    return queryClient.getQueriesData<InfiniteData<PostsPage>>({ queryKey })
}

function restoreInfiniteCaches(
    queryClient: QueryClient,
    snapshots: Array<[readonly unknown[], InfiniteData<PostsPage> | undefined]>
) {
    for (const [key, data] of snapshots) {
        queryClient.setQueryData(key, data)
    }
}

function applyPostEverywhere(
    queryClient: QueryClient,
    postId: string,
    updater: (post: Post) => Post
) {
    updatePostInInfiniteCaches(queryClient, ['posts'], postId, updater)
    updatePostInInfiniteCaches(queryClient, ['bookmarks'], postId, updater)
    queryClient.setQueryData<Post>(['post', postId], (old) => (old ? updater(old) : old))
    updatePostInProfileCaches(queryClient, postId, updater)
}

export const usePost = (id: string)=>{
    return useQuery({
        queryKey: ['post', id],
        queryFn: async()=>{
            const res = await api.get(`/post/${id}`)
            return res.data.post
        },
        enabled: !!id,
    })
}

export const useUserPosts = ()=>{
    return useQuery({
        queryKey: ['user-posts'],
        queryFn: async()=>{
            const res = await api.get('/user/posts')
            return res.data.myPost as Post[]
        },
    })
}

export const useUserReposts = ()=>{
    return useQuery({
        queryKey: ['user-reposts'],
        queryFn: async()=>{
            const res = await api.get('/user/reposts')
            return res.data.myReposts as Post[]
        },
    })
}

type UsePostsOptions = {
    tag?: string
    q?: string
    feed?: 'following' | 'for-you'
    enabled?: boolean
}

export const usePosts = (tagOrOptions?: string | UsePostsOptions) => {
    const options: UsePostsOptions =
        typeof tagOrOptions === 'string' ? { tag: tagOrOptions } : tagOrOptions ?? {}
    const normalizedTag = options.tag?.trim().toLowerCase() || undefined
    const normalizedQ = options.q?.trim() || undefined
    const feed = options.feed
    const enabled = options.enabled ?? true

    return useInfiniteQuery({
        queryKey: ['posts', normalizedTag ?? null, normalizedQ ?? null, feed ?? null],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: '10' }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            if (normalizedTag) {
                params.tag = normalizedTag
            }
            if (normalizedQ) {
                params.q = normalizedQ
            }
            if (feed) {
                params.feed = feed
            }
            const res = await api.get('/post', { params })
            return res.data
        },
        getNextPageParam: (lastPage) => {
            return lastPage.hasMore ? lastPage.nextCursor : undefined
        },
        initialPageParam: undefined,
        enabled,
    })
}

export const useTogglePostLike = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
            const res = isLiked
                ? await api.delete(`/post/${postId}/like`)
                : await api.post(`/post/${postId}/like`)
            return res.data as { liked: boolean; likesCount: number }
        },
        onMutate: async ({ postId, isLiked }) => {
            await queryClient.cancelQueries({ queryKey: ['posts'] })
            await queryClient.cancelQueries({ queryKey: ['post', postId] })
            await queryClient.cancelQueries({ queryKey: ['bookmarks'] })
            await queryClient.cancelQueries({ queryKey: ['user-posts'] })
            await queryClient.cancelQueries({ queryKey: ['user-reposts'] })

            const prevFeeds = snapshotInfiniteCaches(queryClient, ['posts'])
            const prevBookmarks = snapshotInfiniteCaches(queryClient, ['bookmarks'])
            const prevPost = queryClient.getQueryData<Post>(['post', postId])
            const prevProfilePosts = snapshotProfilePostCaches(queryClient)

            applyPostEverywhere(queryClient, postId, (p) => toggleLikeState(p, isLiked))

            return { prevFeeds, prevBookmarks, prevPost, prevProfilePosts, postId }
        },
        onSuccess: (data, { postId }) => {
            applyPostEverywhere(queryClient, postId, (p) => ({
                ...p,
                isLiked: data.liked,
                likesCount: data.likesCount,
            }))
        },
        onError: (_err, { postId }, context) => {
            if (context?.prevFeeds) restoreInfiniteCaches(queryClient, context.prevFeeds)
            if (context?.prevBookmarks) restoreInfiniteCaches(queryClient, context.prevBookmarks)
            if (context?.prevPost) queryClient.setQueryData(['post', postId], context.prevPost)
            if (context?.prevProfilePosts) restoreProfilePostCaches(queryClient, context.prevProfilePosts)
        },
    })
}

export const useUpdatePost = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            postId,
            content,
            visibility,
        }: {
            postId: string
            content?: string
            visibility?: Post['visibility']
        }) => {
            const body: { content?: string; visibility?: Post['visibility'] } = {}
            if (typeof content === 'string') body.content = content
            if (visibility) body.visibility = visibility
            const res = await api.patch(`/post/${postId}`, body)
            return res.data.post as Post
        },
        onMutate: async ({ postId, content, visibility }) => {
            await queryClient.cancelQueries({ queryKey: ['posts'] })
            await queryClient.cancelQueries({ queryKey: ['post', postId] })
            await queryClient.cancelQueries({ queryKey: ['bookmarks'] })

            const prevFeeds = snapshotInfiniteCaches(queryClient, ['posts'])
            const prevBookmarks = snapshotInfiniteCaches(queryClient, ['bookmarks'])
            const prevPost = queryClient.getQueryData<Post>(['post', postId])
            const prevProfilePosts = snapshotProfilePostCaches(queryClient)

            applyPostEverywhere(queryClient, postId, (p) => ({
                ...p,
                ...(typeof content === 'string' ? { content } : {}),
                ...(visibility ? { visibility } : {}),
            }))

            return { prevFeeds, prevBookmarks, prevPost, prevProfilePosts, postId }
        },
        onError: (_err, { postId }, context) => {
            if (context?.prevFeeds) restoreInfiniteCaches(queryClient, context.prevFeeds)
            if (context?.prevBookmarks) restoreInfiniteCaches(queryClient, context.prevBookmarks)
            if (context?.prevPost) queryClient.setQueryData(['post', postId], context.prevPost)
            if (context?.prevProfilePosts) restoreProfilePostCaches(queryClient, context.prevProfilePosts)
        },
        onSettled: (_data, _err, { postId }) => {
            queryClient.invalidateQueries({ queryKey: ['posts'] })
            queryClient.invalidateQueries({ queryKey: ['post', postId] })
            queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
            invalidateProfilePostCaches(queryClient)
        },
    })
}

export const useDeletePost = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ postId }: { postId: string }) => {
            const res = await api.delete(`/post/${postId}`)
            return res.data as { msg: string }
        },
        onMutate: async ({ postId }) => {
            await queryClient.cancelQueries({ queryKey: ['posts'] })
            await queryClient.cancelQueries({ queryKey: ['bookmarks'] })

            const prevFeeds = snapshotInfiniteCaches(queryClient, ['posts'])
            const prevBookmarks = snapshotInfiniteCaches(queryClient, ['bookmarks'])

            const remove = (old: InfiniteData<PostsPage> | undefined) => {
                if (!old) return old
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        posts: page.posts.filter((p) => p._id !== postId),
                    })),
                }
            }

            queryClient.setQueriesData<InfiniteData<PostsPage>>({ queryKey: ['posts'] }, remove)
            queryClient.setQueriesData<InfiniteData<PostsPage>>({ queryKey: ['bookmarks'] }, remove)

            return { prevFeeds, prevBookmarks }
        },
        onError: (_err, _vars, context) => {
            if (context?.prevFeeds) restoreInfiniteCaches(queryClient, context.prevFeeds)
            if (context?.prevBookmarks) restoreInfiniteCaches(queryClient, context.prevBookmarks)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['posts'] })
            queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
            invalidateProfilePostCaches(queryClient)
        },
    })
}

export const useTogglePostPin = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ postId, isPinned }: { postId: string; isPinned: boolean }) => {
            const res = isPinned
                ? await api.delete(`/post/${postId}/pin`)
                : await api.post(`/post/${postId}/pin`)
            return res.data as { isPinned: boolean }
        },
        onMutate: async ({ postId, isPinned }) => {
            const nextPinned = !isPinned
            await queryClient.cancelQueries({ queryKey: ['post', postId] })
            await queryClient.cancelQueries({ queryKey: ['user-posts'] })
            await queryClient.cancelQueries({ queryKey: ['posts'] })

            const prevPost = queryClient.getQueryData<Post>(['post', postId])
            const prevProfilePosts = snapshotProfilePostCaches(queryClient)
            const prevFeeds = snapshotInfiniteCaches(queryClient, ['posts'])

            queryClient.setQueryData<Post>(['post', postId], (old) =>
                old
                    ? {
                          ...old,
                          isPinned: nextPinned,
                          pinnedAt: nextPinned ? new Date() : undefined,
                      }
                    : old
            )
            applyPinInProfileCaches(queryClient, postId, nextPinned)
            // Badge on feeds; order only matters on profile
            updatePostInInfiniteCaches(queryClient, ['posts'], postId, (p) => ({
                ...p,
                isPinned: nextPinned,
                pinnedAt: nextPinned ? new Date() : undefined,
            }))

            return { prevPost, prevProfilePosts, prevFeeds, postId }
        },
        onError: (_err, { postId }, context) => {
            if (context?.prevPost) queryClient.setQueryData(['post', postId], context.prevPost)
            if (context?.prevProfilePosts) restoreProfilePostCaches(queryClient, context.prevProfilePosts)
            if (context?.prevFeeds) restoreInfiniteCaches(queryClient, context.prevFeeds)
        },
        onSettled: (_data, _err, { postId }) => {
            queryClient.invalidateQueries({ queryKey: ['post', postId] })
            invalidateProfilePostCaches(queryClient)
        },
    })
}

export const useTogglePostRepost = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ postId, isReposted }: { postId: string; isReposted: boolean }) => {
            const res = isReposted
                ? await api.delete(`/post/${postId}/repost`)
                : await api.post(`/post/${postId}/repost`)
            return res.data as { reposted: boolean; repostsCount: number }
        },
        onMutate: async ({ postId, isReposted }) => {
            await queryClient.cancelQueries({ queryKey: ['posts'] })
            await queryClient.cancelQueries({ queryKey: ['post', postId] })
            await queryClient.cancelQueries({ queryKey: ['bookmarks'] })
            await queryClient.cancelQueries({ queryKey: ['user-posts'] })
            await queryClient.cancelQueries({ queryKey: ['user-reposts'] })

            const prevFeeds = snapshotInfiniteCaches(queryClient, ['posts'])
            const prevBookmarks = snapshotInfiniteCaches(queryClient, ['bookmarks'])
            const prevPost = queryClient.getQueryData<Post>(['post', postId])
            const prevProfilePosts = snapshotProfilePostCaches(queryClient)

            applyPostEverywhere(queryClient, postId, (p) => toggleRepostState(p, isReposted))

            return { prevFeeds, prevBookmarks, prevPost, prevProfilePosts, postId }
        },
        onSuccess: (data, { postId }) => {
            applyPostEverywhere(queryClient, postId, (p) => ({
                ...p,
                isReposted: data.reposted,
                repostsCount: data.repostsCount,
            }))
            // Repost list membership may change — refresh profile reposts quietly.
            queryClient.invalidateQueries({ queryKey: ['user-reposts'] })
        },
        onError: (_err, { postId }, context) => {
            if (context?.prevFeeds) restoreInfiniteCaches(queryClient, context.prevFeeds)
            if (context?.prevBookmarks) restoreInfiniteCaches(queryClient, context.prevBookmarks)
            if (context?.prevPost) queryClient.setQueryData(['post', postId], context.prevPost)
            if (context?.prevProfilePosts) restoreProfilePostCaches(queryClient, context.prevProfilePosts)
        },
    })
}

export const useViewPost = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (postId: string) => {
            const res = await api.post(`/post/${postId}/view`)
            return { postId, ...(res.data as { viewed: boolean; viewsCount: number }) }
        },
        onSuccess: ({ postId, viewsCount }) => {
            applyPostEverywhere(queryClient, postId, (p) => ({
                ...p,
                viewsCount,
            }))
        },
    })
}

function removePostFromInfiniteCaches(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    postId: string
) {
    queryClient.setQueriesData<InfiniteData<PostsPage>>({ queryKey }, (old) => {
        if (!old) return old
        return {
            ...old,
            pages: old.pages.map((page) => ({
                ...page,
                posts: page.posts.filter((p) => p._id !== postId),
            })),
        }
    })
}

export const useNotInterestedPost = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (postId: string) => {
            const res = await api.post(`/post/${postId}/feedback`, {
                type: 'not_interested',
            })
            return { postId, ...(res.data as { ok: boolean; type: string }) }
        },
        onMutate: async (postId) => {
            await queryClient.cancelQueries({ queryKey: ['posts'] })
            const prevFeeds = snapshotInfiniteCaches(queryClient, ['posts'])
            const prevBookmarks = snapshotInfiniteCaches(queryClient, ['bookmarks'])
            const prevViewed = snapshotInfiniteCaches(queryClient, ['viewed-posts'])
            removePostFromInfiniteCaches(queryClient, ['posts'], postId)
            removePostFromInfiniteCaches(queryClient, ['bookmarks'], postId)
            removePostFromInfiniteCaches(queryClient, ['viewed-posts'], postId)
            return { prevFeeds, prevBookmarks, prevViewed }
        },
        onError: (_err, _postId, context) => {
            if (context?.prevFeeds) restoreInfiniteCaches(queryClient, context.prevFeeds)
            if (context?.prevBookmarks) restoreInfiniteCaches(queryClient, context.prevBookmarks)
            if (context?.prevViewed) restoreInfiniteCaches(queryClient, context.prevViewed)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['posts'] })
            queryClient.invalidateQueries({ queryKey: ['user-suggestions'] })
        },
    })
}

export const useVotePoll = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            postId,
            optionId,
        }: {
            postId: string
            optionId: string
        }) => {
            const res = await api.post(`/post/${postId}/poll/vote`, { optionId })
            return res.data as {
                poll: Post['poll']
                myVoteOptionId: string | null
            }
        },
        onMutate: async ({ postId, optionId }) => {
            await queryClient.cancelQueries({ queryKey: ['posts'] })
            await queryClient.cancelQueries({ queryKey: ['post', postId] })
            await queryClient.cancelQueries({ queryKey: ['bookmarks'] })
            await queryClient.cancelQueries({ queryKey: ['user-posts'] })
            await queryClient.cancelQueries({ queryKey: ['user-reposts'] })

            const prevFeeds = snapshotInfiniteCaches(queryClient, ['posts'])
            const prevBookmarks = snapshotInfiniteCaches(queryClient, ['bookmarks'])
            const prevPost = queryClient.getQueryData<Post>(['post', postId])
            const prevProfilePosts = snapshotProfilePostCaches(queryClient)

            applyPostEverywhere(queryClient, postId, (p) =>
                applyPollVoteState(p, optionId)
            )

            return { prevFeeds, prevBookmarks, prevPost, prevProfilePosts, postId }
        },
        onSuccess: (data, { postId }) => {
            applyPostEverywhere(queryClient, postId, (p) => ({
                ...p,
                poll: data.poll ?? p.poll,
                myVoteOptionId: data.myVoteOptionId,
            }))
        },
        onError: (_err, { postId }, context) => {
            if (context?.prevFeeds) restoreInfiniteCaches(queryClient, context.prevFeeds)
            if (context?.prevBookmarks) restoreInfiniteCaches(queryClient, context.prevBookmarks)
            if (context?.prevPost) queryClient.setQueryData(['post', postId], context.prevPost)
            if (context?.prevProfilePosts) restoreProfilePostCaches(queryClient, context.prevProfilePosts)
        },
    })
}

