import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalNav } from "@/components/ConditionalNav";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tampa's Finest — War Room",
  description: "Tampa's Finest Fantasy Baseball — Season Management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-background font-[family-name:var(--font-sans)] text-foreground antialiased">
        <ConditionalNav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
