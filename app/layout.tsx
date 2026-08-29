import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { SanityLive } from "@/sanity/lib/live";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skiply",
  description:
    "A unified design language for the Skiply learning platform. Clean, modern and focused on clarity, consistency and intuitive learning experiences.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col font-sans"
        suppressHydrationWarning
      >
        <ClerkProvider>
          {children}
        </ClerkProvider>
        <SanityLive />
      </body>
    </html>
  );
}