import { api } from "@/lib/api/axios"
import { Post } from "@/types/post"
import { useInfiniteQuery } from "@tanstack/react-query"

interface PostsPage {
    posts: Post[]
    hasMore: boolean
    nextCursor?: string | null
}

export const useViewedPosts = () => {
    return useInfiniteQuery({
        queryKey: ["viewed-posts"],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "10" }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            const res = await api.get("/user/viewed-posts", { params })
            return res.data as PostsPage
        },
        getNextPageParam: (lastPage) =>
            lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
        initialPageParam: undefined as string | undefined,
    })
}
