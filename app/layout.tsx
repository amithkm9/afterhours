import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "After Hours — Let your agents break the ice",
  description: "Evidence-backed profiles, thoughtful agent dates, and explained matches. Built from LinkedIn and public Instagram.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
