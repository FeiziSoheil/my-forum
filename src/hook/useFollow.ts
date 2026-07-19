import { api } from "@/lib/api/axios"
import { Post, Reply } from "@/types/post"
import { FollowListPage, PublicProfile } from "@/types/user"
import { InfiniteData, QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

type RepliesPage = {
    replies: Reply[]
    hasMore: boolean
    nextCursor?: string
}

function patchAuthorFollowState(
    queryClient: QueryClient,
    username: string,
    patch: { isFollowing: boolean; isRequested: boolean }
) {
    queryClient.setQueriesData<Post>({ queryKey: ['post'] }, (old) => {
        if (!old?.author || old.author.username !== username) return old
        return { ...old, ...patch }
    })

    queryClient.setQueriesData<InfiniteData<RepliesPage>>({ queryKey: ['replies'] }, (old) => {
        if (!old) return old
        return {
            ...old,
            pages: old.pages.map((page) => ({
                ...page,
                replies: page.replies.map((r) =>
                    r.author?.username === username ? { ...r, ...patch } : r
                ),
            })),
        }
    })
}

export const usePublicProfile = (username: string) => {
    return useQuery({
        queryKey: ['user', username],
        queryFn: async () => {
            const res = await api.get(`/user/${username}`)
            return res.data.user as PublicProfile
        },
        enabled: !!username,
    })
}

export const useUserPostsByUsername = (username: string, enabled = true) => {
    return useQuery({
        queryKey: ['user-posts', username],
        queryFn: async () => {
            const res = await api.get(`/user/${username}/posts`)
            return res.data.posts as Post[]
        },
        enabled: !!username && enabled,
    })
}

export const useUserRepliesByUsername = (username: string, enabled = true) => {
    return useQuery({
        queryKey: ['user-replies', username],
        queryFn: async () => {
            const res = await api.get(`/user/${username}/replies`)
            return res.data.replies as Reply[]
        },
        enabled: !!username && enabled,
    })
}

export const useUserRepostsByUsername = (username: string, enabled = true) => {
    return useQuery({
        queryKey: ['user-reposts', username],
        queryFn: async () => {
            const res = await api.get(`/user/${username}/reposts`)
            return res.data.posts as Post[]
        },
        enabled: !!username && enabled,
    })
}

export const useFollowers = (username: string, enabled = true) => {
    return useInfiniteQuery({
        queryKey: ['followers', username],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: '20' }
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get(`/user/${username}/followers`, { params })
            return res.data as FollowListPage
        },
        getNextPageParam: (lastPage) =>
            lastPage.hasMore ? lastPage.nextCursor : undefined,
        initialPageParam: undefined as string | undefined,
        enabled: !!username && enabled,
    })
}

export const useFollowing = (username: string, enabled = true) => {
    return useInfiniteQuery({
        queryKey: ['following', username],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: '20' }
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get(`/user/${username}/following`, { params })
            return res.data as FollowListPage
        },
        getNextPageParam: (lastPage) =>
            lastPage.hasMore ? lastPage.nextCursor : undefined,
        initialPageParam: undefined as string | undefined,
        enabled: !!username && enabled,
    })
}

export type FollowRequestItem = {
    _id: string
    createdAt: string | Date
    from: {
        _id: string
        username: string
        fullname: string
        avatar?: string
    }
}

export const useFollowRequests = (enabled = true) => {
    return useQuery({
        queryKey: ['follow-requests'],
        queryFn: async () => {
            const res = await api.get('/user/follow-requests')
            return (res.data.requests ?? []) as FollowRequestItem[]
        },
        enabled,
    })
}

export const useRespondFollowRequest = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            id,
            action,
        }: {
            id: string
            action: 'accept' | 'reject'
        }) => {
            const res = await api.post(`/user/follow-requests/${id}/${action}`)
            return res.data as {
                accepted?: boolean
                rejected?: boolean
                following?: boolean
                followersCount?: number
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['follow-requests'] })
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['user'] })
            queryClient.invalidateQueries({ queryKey: ['me'] })
            queryClient.invalidateQueries({ queryKey: ['followers'] })
            queryClient.invalidateQueries({ queryKey: ['following'] })
            queryClient.invalidateQueries({ queryKey: ['stories'] })
        },
    })
}

type ToggleFollowVars = {
    username: string
    /** True when currently following — DELETE unfollow. */
    isFollowing: boolean
    /** True when a pending request exists — DELETE cancels it. */
    isRequested?: boolean
}

export const useToggleFollow = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ username, isFollowing, isRequested }: ToggleFollowVars) => {
            // Following or pending request → DELETE (unfollow / cancel)
            const shouldDelete = isFollowing || !!isRequested
            const res = shouldDelete
                ? await api.delete(`/user/${username}/follow`)
                : await api.post(`/user/${username}/follow`)
            return res.data as {
                following: boolean
                requested: boolean
                followersCount: number
            }
        },
        onMutate: async ({ username, isFollowing, isRequested }) => {
            await queryClient.cancelQueries({ queryKey: ['user', username] })
            await queryClient.cancelQueries({ queryKey: ['followers'] })
            await queryClient.cancelQueries({ queryKey: ['following'] })

            const prevProfile = queryClient.getQueryData<PublicProfile>(['user', username])

            queryClient.setQueryData<PublicProfile>(['user', username], (old) => {
                if (!old) return old

                // Cancel pending request — stay locked, no count change
                if (isRequested && !isFollowing) {
                    return {
                        ...old,
                        isRequested: false,
                        isFollowing: false,
                        canView: !old.isPrivate,
                    }
                }

                // Unfollow
                if (isFollowing) {
                    return {
                        ...old,
                        isFollowing: false,
                        isRequested: false,
                        followersCount: Math.max(0, (old.followersCount ?? 0) - 1),
                        canView: !old.isPrivate,
                    }
                }

                // New follow / request
                if (old.isPrivate) {
                    // Private → request only; canView stays false
                    return {
                        ...old,
                        isFollowing: false,
                        isRequested: true,
                        canView: false,
                    }
                }

                // Public → immediate follow
                return {
                    ...old,
                    isFollowing: true,
                    isRequested: false,
                    followersCount: (old.followersCount ?? 0) + 1,
                    canView: true,
                }
            })

            // Optimistic patch for post detail + reply threads
            if (isRequested && !isFollowing) {
                patchAuthorFollowState(queryClient, username, {
                    isFollowing: false,
                    isRequested: false,
                })
            } else if (isFollowing) {
                patchAuthorFollowState(queryClient, username, {
                    isFollowing: false,
                    isRequested: false,
                })
            } else if (prevProfile?.isPrivate) {
                patchAuthorFollowState(queryClient, username, {
                    isFollowing: false,
                    isRequested: true,
                })
            } else {
                // Unknown privacy → assume public follow; onSuccess will correct
                patchAuthorFollowState(queryClient, username, {
                    isFollowing: true,
                    isRequested: false,
                })
            }

            // Only patch follow-list rows when toggling a real follow state
            if (isFollowing || (!isRequested && !(prevProfile?.isPrivate))) {
                const nextFollowing = !isFollowing
                const patchList = (key: 'followers' | 'following') => {
                    queryClient.setQueriesData<{ pages: FollowListPage[]; pageParams: unknown[] }>(
                        { queryKey: [key] },
                        (old) => {
                            if (!old) return old
                            return {
                                ...old,
                                pages: old.pages.map((page) => ({
                                    ...page,
                                    users: page.users.map((u) =>
                                        u.username === username
                                            ? { ...u, isFollowing: nextFollowing }
                                            : u
                                    ),
                                })),
                            }
                        }
                    )
                }
                patchList('followers')
                patchList('following')
            }

            return { prevProfile, username }
        },
        onSuccess: (data, { username }) => {
            patchAuthorFollowState(queryClient, username, {
                isFollowing: data.following,
                isRequested: data.requested,
            })
            queryClient.setQueryData<PublicProfile>(['user', username], (old) => {
                if (!old) return old
                return {
                    ...old,
                    isFollowing: data.following,
                    isRequested: data.requested,
                    followersCount: data.followersCount ?? old.followersCount,
                    canView: data.following || !old.isPrivate,
                }
            })
        },
        onError: (_err, { username }, context) => {
            if (context?.prevProfile) queryClient.setQueryData(['user', username], context.prevProfile)
            queryClient.invalidateQueries({ queryKey: ['followers'] })
            queryClient.invalidateQueries({ queryKey: ['following'] })
            queryClient.invalidateQueries({ queryKey: ['post'] })
            queryClient.invalidateQueries({ queryKey: ['replies'] })
        },
        onSettled: (_data, _err, { username }) => {
            queryClient.invalidateQueries({ queryKey: ['user', username] })
            queryClient.invalidateQueries({ queryKey: ['me'] })
            queryClient.invalidateQueries({ queryKey: ['followers'] })
            queryClient.invalidateQueries({ queryKey: ['following'] })
            queryClient.invalidateQueries({ queryKey: ['user-posts', username] })
            queryClient.invalidateQueries({ queryKey: ['user-replies', username] })
            queryClient.invalidateQueries({ queryKey: ['user-reposts', username] })
            // Private authors' stories appear/disappear from the rail on follow change.
            queryClient.invalidateQueries({ queryKey: ['stories'] })
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['user-suggestions'] })
        },
    })
}
