import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthContext";
import { PwaProvider } from "@/components/layout/pwa-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Moh Foods NG - Enterprise Operations Platform",
  description: "Internal Operations, Store Inventory & Management Platform for Moh Foods Nigeria",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MOH-OPS",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/Moh-Logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full bg-[#F8FAFC] ${inter.variable} ${inter.className}`}>
      <head>
        <meta name="theme-color" content="#8E1538" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MOH-OPS" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className={`h-full flex flex-col antialiased text-[#1E293B] ${inter.className}`}>
        <AuthProvider>
          <PwaProvider>
            {children}
          </PwaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

