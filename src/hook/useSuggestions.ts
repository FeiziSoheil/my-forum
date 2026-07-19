import { api } from "@/lib/api/axios";
import { SuggestedUser } from "@/types/user";
import { useQuery } from "@tanstack/react-query";

export function useSuggestedPeople(limit = 8, enabled = true) {
  return useQuery({
    queryKey: ["user-suggestions", limit],
    queryFn: async () => {
      const res = await api.get("/users/suggestions", {
        params: { limit },
      });
      return (res.data.users ?? []) as SuggestedUser[];
    },
    enabled,
    staleTime: 60_000,
  });
}
