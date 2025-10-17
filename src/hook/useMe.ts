import { api } from "@/lib/api/axios"
import { useQuery } from "@tanstack/react-query"


export const  fetchMe = async () => await api.get('/auth/me').then(res=>res.data.data)

export function useMe() {
    return useQuery ({
        queryKey: ['me'],
        queryFn: fetchMe,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

