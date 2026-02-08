import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ollama Chat",
  description: "Self-hosted ChatGPT-style interface for local Ollama models",
  icons: {
    icon: [
      { url: "/favicon/favicon-32x32.webp", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.webp", sizes: "16x16", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.webp",
    shortcut: "/favicon/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
