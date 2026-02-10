import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HUD WebApp",
  description: "Streamer/Viewer HUD with Admin",
};

// No global scripts (e.g. public/index.js) or window.onresize are used in this app.
// If you see "Cannot read properties of undefined (reading 'style')" at index.js, it is
// likely from a dependency bundle (e.g. livekit-client); the HUD is wrapped in an error boundary.

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
