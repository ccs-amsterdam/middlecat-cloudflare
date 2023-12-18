import { useQuery } from "@tanstack/react-query";

export default function useCsrf() {
  return useQuery({
    queryKey: ["csrfToken"],
    queryFn: () => fetch("/api/auth/csrf").then((res) => res.json()),
  });
}
