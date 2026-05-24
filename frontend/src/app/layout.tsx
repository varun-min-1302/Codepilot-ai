import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import CommandPalette from "@/components/CommandPalette";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "CodePilot AI | Automated Pull Request Auditing Platform",
  description: "Identify vulnerabilities, optimize algorithms, and generate immediate PR summaries via advanced AI review cycles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased text-zinc-200 bg-zinc-950 min-h-screen">
        {children}
        <CommandPalette />
      </body>
    </html>
  );
}
