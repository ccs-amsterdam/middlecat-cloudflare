import { Poppins } from "next/font/google";
import { Metadata } from "next";

const font = Poppins({
  weight: "500",
  subsets: ["latin"],
  display: "swap",
});

// export const runtime = "edge";

export const metadata: Metadata = {
  title: "NextJSzDemo Client",
  description: "Middlecat demo client",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  );
}
