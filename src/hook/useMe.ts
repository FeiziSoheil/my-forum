import { api } from "@/lib/api/axios"
import { useQuery } from "@tanstack/react-query"
import type { User } from "@/types/user"


export const fetchMe = async (): Promise<User> => {
  const { data } = await api.get('/auth/me');
  return data.user as User;
};

export function useMe() {
    return useQuery ({
        queryKey: ['me'],
        queryFn: fetchMe,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error) => {
          // اگر خطای 401 باشد، دوباره تلاش نکن
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            return false;
          }
          // برای خطاهای دیگر، حداکثر 3 بار تلاش کن
          return failureCount < 3;
        },
        retryDelay: 1000,
    })
}

