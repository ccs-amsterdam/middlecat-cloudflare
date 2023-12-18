import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";

interface Props {
  children: ReactNode;
}

const queryClient = new QueryClient();

export default function ClientProviders({ children }: Props) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
