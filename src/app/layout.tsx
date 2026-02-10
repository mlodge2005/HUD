import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HUD WebApp",
  description: "Streamer/Viewer HUD with Admin",
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
