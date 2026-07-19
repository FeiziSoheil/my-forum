import { api } from "@/lib/api/axios"
import { Post } from "@/types/post"
import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface PostsPage {
    posts: Post[]
    hasMore: boolean
    nextCursor?: string
}

const setBookmarkState = <T extends { isBookmarked?: boolean }>(item: T, bookmarked: boolean): T => ({
    ...item,
    isBookmarked: bookmarked,
})

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

function updatePostInInfiniteCaches(
    queryClient: ReturnType<typeof useQueryClient>,
    queryKey: readonly unknown[],
    postId: string,
    updater: (post: Post) => Post
) {
    queryClient.setQueriesData<InfiniteData<PostsPage>>({ queryKey }, (old) =>
        mapPostInInfiniteData(old, postId, updater)
    )
}

function snapshotInfiniteCaches(
    queryClient: ReturnType<typeof useQueryClient>,
    queryKey: readonly unknown[]
) {
    return queryClient.getQueriesData<InfiniteData<PostsPage>>({ queryKey })
}

function restoreInfiniteCaches(
    queryClient: ReturnType<typeof useQueryClient>,
    snapshots: Array<[readonly unknown[], InfiniteData<PostsPage> | undefined]>
) {
    for (const [key, data] of snapshots) {
        queryClient.setQueryData(key, data)
    }
}

export const useBookmarks = () => {
    return useInfiniteQuery({
        queryKey: ['bookmarks'],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: '10', feed: 'bookmarks' }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            const res = await api.get('/post', { params })
            return res.data as PostsPage
        },
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
        initialPageParam: undefined as string | undefined,
    })
}

export const useToggleBookmark = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ postId, isBookmarked }: { postId: string; isBookmarked: boolean }) => {
            const res = isBookmarked
                ? await api.delete(`/post/${postId}/bookmark`)
                : await api.post(`/post/${postId}/bookmark`)
            return res.data as { bookmarked: boolean }
        },
        onMutate: async ({ postId, isBookmarked }) => {
            await queryClient.cancelQueries({ queryKey: ['posts'] })
            await queryClient.cancelQueries({ queryKey: ['post', postId] })
            await queryClient.cancelQueries({ queryKey: ['bookmarks'] })

            const prevFeeds = snapshotInfiniteCaches(queryClient, ['posts'])
            const prevBookmarks = snapshotInfiniteCaches(queryClient, ['bookmarks'])
            const prevPost = queryClient.getQueryData<Post>(['post', postId])

            const nextBookmarked = !isBookmarked
            const apply = (p: Post) => setBookmarkState(p, nextBookmarked)

            updatePostInInfiniteCaches(queryClient, ['posts'], postId, apply)
            queryClient.setQueryData<Post>(['post', postId], (old) => (old ? apply(old) : old))

            // Removing a bookmark from the bookmarks page drops it from the list.
            if (isBookmarked) {
                queryClient.setQueriesData<InfiniteData<PostsPage>>({ queryKey: ['bookmarks'] }, (old) => {
                    if (!old) return old
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            posts: page.posts.filter((p) => p._id !== postId),
                        })),
                    }
                })
            } else {
                updatePostInInfiniteCaches(queryClient, ['bookmarks'], postId, apply)
            }

            return { prevFeeds, prevBookmarks, prevPost, postId }
        },
        onSuccess: (data, { postId, isBookmarked }) => {
            const apply = (p: Post) => setBookmarkState(p, data.bookmarked)
            updatePostInInfiniteCaches(queryClient, ['posts'], postId, apply)
            queryClient.setQueryData<Post>(['post', postId], (old) => (old ? apply(old) : old))
            updatePostInInfiniteCaches(queryClient, ['bookmarks'], postId, apply)

            // Newly bookmarked posts should appear in the bookmarks feed.
            if (!isBookmarked && data.bookmarked) {
                queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
            }
        },
        onError: (_err, { postId }, context) => {
            if (context?.prevFeeds) restoreInfiniteCaches(queryClient, context.prevFeeds)
            if (context?.prevBookmarks) restoreInfiniteCaches(queryClient, context.prevBookmarks)
            if (context?.prevPost) queryClient.setQueryData(['post', postId], context.prevPost)
        },
    })
}
