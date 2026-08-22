import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FoundathyonProvider, TooltipProvider } from "@foundathyon/community-ui";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/context/i18n-context";
import { BRAND_ACCENT } from "@/lib/brand";
// Order matters: both sheets are independent Tailwind builds declaring the same
// utility class names, and at equal specificity the LAST one wins (media queries
// add no specificity). styles.css goes last so the library's own responsive
// utilities survive — DataTable switches to a card layout via `md:hidden` /
// `md:block`, which the app build's unconditional `.hidden` was overriding,
// rendering every table as mobile cards on desktop. The app has only one
// conditional-display utility of its own, and it uses an inline style instead.
import "./globals.css";
import "@foundathyon/community-ui/styles.css";

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
