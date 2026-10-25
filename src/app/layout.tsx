import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { CATCH_INSTALL_PROMPT_SCRIPT } from "@/lib/pwa-script";
import { APPLY_THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VYBZ",
    template: "%s · VYBZ",
  },
  description: "Real friends. More vibes. Share everyday moments, keep your circles close, and make plans together.",
  applicationName: "VYBZ",
  // iPhone/iPad "Add to Home Screen": open full-screen with a dark status bar.
  appleWebApp: { capable: true, title: "VYBZ", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Browser/status bar colour while using VYBZ: the app's dark background, so it blends in.
  themeColor: "#0b0b0f",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script below may switch data-theme before React loads, hence suppressHydrationWarning.
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${geist.variable} ${bricolage.variable} antialiased`}>
      <head>
        {/* Apply the saved Dark/Light/Auto theme before the first paint; see src/lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: APPLY_THEME_SCRIPT }} />
        {/* Catch the "can be installed" event early; see src/lib/pwa.ts. */}
        <script dangerouslySetInnerHTML={{ __html: CATCH_INSTALL_PROMPT_SCRIPT }} />
      </head>
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
