import { api } from "@/lib/api/axios"
import { toggleLikeState } from "@/hook/usePosts"
import { Reply } from "@/types/post"
import { InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export const useUserReplies = () => {
    return useQuery({
        queryKey: ['user-replies'],
        queryFn: async () => {
            const res = await api.get('/user/replies')
            return res.data.myReply as Reply[]
        },
    })
}

interface RepliesPage {
    replies: Reply[]
    hasMore: boolean
    nextCursor?: string
}

export const useReplies = (postId: string) => {
    return useInfiniteQuery({
        queryKey: ['replies', postId],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: '10' }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            const res = await api.get(`/post/${postId}/replies`, { params })
            return res.data
        },
        getNextPageParam: (lastPage) => {
            return lastPage.hasMore ? lastPage.nextCursor : undefined
        },
        initialPageParam: undefined,
        enabled: !!postId,
    })
}

export const useReply = (postId: string, replyId: string | null | undefined) => {
    return useQuery({
        queryKey: ['reply', postId, replyId],
        queryFn: async () => {
            const res = await api.get(`/post/${postId}/replies/${replyId}`)
            return res.data.reply as Reply
        },
        enabled: !!postId && !!replyId,
    })
}

export const useCreateReply = (postId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            content,
            parentReplyId,
            mediaFiles,
        }: {
            content: string
            parentReplyId?: string | null
            mediaFiles?: File[]
        }) => {
            const formData = new FormData()
            formData.append('content', content)
            if (parentReplyId) {
                formData.append('parentReplyId', parentReplyId)
            }
            mediaFiles?.forEach((file) => {
                formData.append('media', file)
            })
            const res = await api.post(`/post/${postId}/replies`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['replies', postId] })
            queryClient.invalidateQueries({ queryKey: ['post', postId] })
        },
    })
}

export const useUpdateReply = (postId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ replyId, content }: { replyId: string; content: string }) => {
            const res = await api.patch(`/post/${postId}/replies/${replyId}`, { content })
            return res.data.reply as Reply
        },
        onMutate: async ({ replyId, content }) => {
            await queryClient.cancelQueries({ queryKey: ['replies', postId] })

            const prevReplies = queryClient.getQueryData<InfiniteData<RepliesPage>>(['replies', postId])

            queryClient.setQueryData<InfiniteData<RepliesPage>>(['replies', postId], (old) => {
                if (!old) return old
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        replies: page.replies.map((r) => (r._id === replyId ? { ...r, content } : r)),
                    })),
                }
            })

            return { prevReplies }
        },
        onError: (_err, _vars, context) => {
            if (context?.prevReplies) queryClient.setQueryData(['replies', postId], context.prevReplies)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['replies', postId] })
        },
    })
}

export const useDeleteReply = (postId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ replyId }: { replyId: string }) => {
            const res = await api.delete(`/post/${postId}/replies/${replyId}`)
            return res.data as { msg: string }
        },
        onMutate: async ({ replyId }) => {
            await queryClient.cancelQueries({ queryKey: ['replies', postId] })

            const prevReplies = queryClient.getQueryData<InfiniteData<RepliesPage>>(['replies', postId])

            queryClient.setQueryData<InfiniteData<RepliesPage>>(['replies', postId], (old) => {
                if (!old) return old
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        replies: page.replies.filter((r) => r._id !== replyId),
                    })),
                }
            })

            return { prevReplies }
        },
        onError: (_err, _vars, context) => {
            if (context?.prevReplies) queryClient.setQueryData(['replies', postId], context.prevReplies)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['replies', postId] })
            queryClient.invalidateQueries({ queryKey: ['post', postId] })
        },
    })
}

export const useToggleReplyLike = (postId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ replyId, isLiked }: { replyId: string; isLiked: boolean }) => {
            const res = isLiked
                ? await api.delete(`/post/${postId}/replies/${replyId}/like`)
                : await api.post(`/post/${postId}/replies/${replyId}/like`)
            return res.data as { liked: boolean; likesCount: number }
        },
        onMutate: async ({ replyId, isLiked }) => {
            await queryClient.cancelQueries({ queryKey: ['replies', postId] })

            const prevReplies = queryClient.getQueryData<InfiniteData<RepliesPage>>(['replies', postId])

            queryClient.setQueryData<InfiniteData<RepliesPage>>(['replies', postId], (old) => {
                if (!old) return old
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        replies: page.replies.map((r) => (r._id === replyId ? toggleLikeState(r, isLiked) : r)),
                    })),
                }
            })

            return { prevReplies }
        },
        onSuccess: (data, { replyId }) => {
            queryClient.setQueryData<InfiniteData<RepliesPage>>(['replies', postId], (old) => {
                if (!old) return old
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        replies: page.replies.map((r) =>
                            r._id === replyId
                                ? { ...r, isLiked: data.liked, likesCount: data.likesCount }
                                : r
                        ),
                    })),
                }
            })
        },
        onError: (_err, _vars, context) => {
            if (context?.prevReplies) queryClient.setQueryData(['replies', postId], context.prevReplies)
        },
    })
}
