"use client";

import { Poppins } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import Header from "@/components/Header";

const font = Poppins({
  weight: "500",
  subsets: ["devanagari"],
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={font.className}>
        <Header />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
