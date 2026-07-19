import type { Metadata } from "next";

import "./globals.css";
import QueryProvider from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/components/providers/theme-provider";
import ConditionalLayout from "../components/ConditionalLayout";




export const metadata: Metadata = {
  title: "Parakgram",
  description: "Parakgram — named for Parak, Soheil's star. Share, connect, and shine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={` antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
              storageKey="parakgram-theme"
              themes={["light", "dark", "theme-blue", "theme-green", "theme-purple", "theme-orange", "theme-rose"]}
              enableColorScheme={false}
            >
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
              <Toaster />
            </ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
