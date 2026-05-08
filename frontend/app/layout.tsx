import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/providers/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CUE AI | Operational Control",
  description: "LinkedIn Automation Control Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased flex overflow-hidden",
          geistSans.variable,
          geistMono.variable
        )}
      >
        <QueryProvider>
          <Sidebar />
          <main className="flex-1 h-screen overflow-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/20 via-background to-background p-8">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </QueryProvider>
      </body>
    </html>
  );
}
