import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});
const providersSchema = z.record(ProviderSchema);

export default function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: fetchProviders,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

export async function fetchProviders() {
  const res = await fetch("/api/auth/providers");
  const data = await res.json();
  console.log(data);
  return providersSchema.parse(data);
}
