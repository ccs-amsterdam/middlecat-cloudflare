import { Poppins } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import Header from "@/components/Header";
import StyledJsxRegistry from "./registry";
import { Metadata } from "next";

const font = Poppins({
  weight: "500",
  subsets: ["latin"],
  display: "swap",
});

export const runtime = "edge";

export const metadata: Metadata = {
  title: "MiddleCat",
  description: "cat-in-the-middle authentication",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={font.className}>
        <StyledJsxRegistry>
          <Header />
          <ClientProviders>{children}</ClientProviders>
        </StyledJsxRegistry>
      </body>
    </html>
  );
}
