import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "قیمت‌یاب شماره رند",
  description: "شماره موبایل خود را وارد کنید و قیمت تقریبی آن را بر اساس الگوی رند و آگهی‌های بازار ببینید.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <Suspense fallback={<div className="h-16 border-b border-separator" />}>
            <Navbar />
          </Suspense>
          <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
