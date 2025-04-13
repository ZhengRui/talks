import type { Metadata } from "next";
import "./globals.css";

// Import reveal.js core styles
import "reveal.js/dist/reveal.css";
// Import reveal.js theme (e.g., black theme)
import "reveal.js/dist/theme/black.css";

export const metadata: Metadata = {
  title: "Presentation Hub",
  description: "Rui's talk collection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
