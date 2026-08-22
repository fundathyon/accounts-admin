import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FoundathyonProvider, TooltipProvider } from "@foundathyon/community-ui";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/context/i18n-context";
import { BRAND_ACCENT } from "@/lib/brand";
// Order matters while shadcn and community-ui coexist. Both ship a Tailwind
// build declaring the same utility class names, and at equal specificity the
// stylesheet loaded LAST wins — media queries add no specificity. With
// styles.css last, its unconditional `.hidden` beat globals.css's `md:flex`
// and collapsed the sidebar. Keeping the app's own sheet last lets its
// responsive utilities win; this constraint disappears once shadcn is gone.
import "@foundathyon/community-ui/styles.css";
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
          <FoundathyonProvider accent={BRAND_ACCENT}>
            <I18nProvider>
              <TooltipProvider>
                {children}
                <Toaster richColors position="bottom-right" />
              </TooltipProvider>
            </I18nProvider>
          </FoundathyonProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
