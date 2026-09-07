import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthContext";
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
  icons: {
    icon: "/Moh-Favico.png",
    shortcut: "/Moh-Favico.png",
    apple: "/Moh-logo.png",
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className={`h-full flex flex-col antialiased text-[#1E293B] ${inter.className}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
