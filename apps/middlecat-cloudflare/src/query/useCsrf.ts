import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const csrfSchema = z.object({
  csrfToken: z.string(),
});

export default function useCsrf() {
  return useQuery({
    queryKey: ["csrfToken"],
    queryFn: fetchCsrf,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

export async function fetchCsrf() {
  const res = await fetch("/api/auth/csrf");
  const data = await res.json();
  return csrfSchema.parse(data).csrfToken;
}
