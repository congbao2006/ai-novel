import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Novel",
  description: "AI Interactive Novel + RPG platform foundation"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
