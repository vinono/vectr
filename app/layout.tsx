import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { UploadedImagesProvider } from "@/components/uploaded-images-provider";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "vectr",
  description: "vectr.store - natural language image search",
};

type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en">
    <body className={cn(sans.variable, mono.variable, "antialiased")}>
      <UploadedImagesProvider>
        {children}
      </UploadedImagesProvider>
      <Analytics />
      <Toaster />
    </body>
  </html>
);

export default RootLayout;
