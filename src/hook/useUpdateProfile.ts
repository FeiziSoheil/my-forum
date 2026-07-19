import { api } from "@/lib/api/axios"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { User } from "@/types/user"

interface UpdateProfileInput {
    fullname?: string
    bio?: string
    location?: string
    avatar?: File | null
    banner?: File | null
    isPrivate?: boolean
}

export function useUpdateProfile() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: UpdateProfileInput): Promise<User> => {
            const formData = new FormData()
            if (input.fullname !== undefined) formData.append('fullname', input.fullname)
            if (input.bio !== undefined) formData.append('bio', input.bio)
            if (input.location !== undefined) formData.append('location', input.location)
            if (input.avatar) formData.append('avatar', input.avatar)
            if (input.banner) formData.append('banner', input.banner)
            if (input.isPrivate !== undefined) formData.append('isPrivate', String(input.isPrivate))

            const { data } = await api.patch('/user', formData)
            return data.user as User
        },
        onSuccess: (user) => {
            queryClient.setQueryData(['me'], user)
            queryClient.invalidateQueries({ queryKey: ['me'] })
            if (user.username) {
                queryClient.invalidateQueries({ queryKey: ['user', user.username] })
            }
            queryClient.invalidateQueries({ queryKey: ['posts'] })
            queryClient.invalidateQueries({ queryKey: ['user-posts'] })
        },
    })
}
