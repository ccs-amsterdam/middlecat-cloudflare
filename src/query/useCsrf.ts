import { useQuery } from "@tanstack/react-query";

interface csrfResponse {
  csrfToken: string;
}

export default function useCsrf() {
  return useQuery({
    queryKey: ["csrfToken"],
    queryFn: fetchCsrf,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

async function fetchCsrf() {
  const res = await fetch("/api/auth/csrf");
  const data: csrfResponse = await res.json();
  return data.csrfToken;
}
