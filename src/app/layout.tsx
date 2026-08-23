import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@foundathyon/community-ui";
import { ThemeProvider } from "@/components/theme-provider";
import { DesignSystemProvider } from "@/components/design-system-provider";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/context/i18n-context";
// Single stylesheet: globals.css imports the design-system tokens and uses
// @source to generate the library's classes in this same Tailwind build.
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Accounts Admin",
  description: "Next-gen authentication admin panel",
  icons: {
    icon: "/accounts-small.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        {/* next-themes stays the outer theme owner (it drives the `class` strategy
            the remaining shadcn styles read); FoundathyonProvider contributes the
            accent and density tokens only. */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <DesignSystemProvider>
            <I18nProvider>
              <TooltipProvider>
                {children}
                <Toaster richColors position="bottom-right" />
              </TooltipProvider>
            </I18nProvider>
          </DesignSystemProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
