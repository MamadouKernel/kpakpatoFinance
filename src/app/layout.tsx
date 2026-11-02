import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FinanceProvider } from "@/context/FinanceContext";
import { HouseholdProvider } from "@/context/HouseholdContext";
import { SalaryProvider } from "@/context/SalaryContext";
import { CommunityProvider } from "@/context/CommunityContext";
import AppLock from "@/components/AppLock";

export const metadata: Metadata = {
  title: "Kpakpato Finance | Gestion Portefeuilles & Coach IA Abidjan",
  description:
    "Application PWA de finances personnelles en FCFA : suivi Wave, Orange Money, MTN MoMo, Moov Money, Djamo, Cash et conseiller financier IA Kpakpato.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kpakpato Finance",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FF7900",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-kpakpato-orange selection:text-white">
        <FinanceProvider>
          <AppLock>
            <HouseholdProvider>
              <SalaryProvider>
                <CommunityProvider>{children}</CommunityProvider>
              </SalaryProvider>
            </HouseholdProvider>
          </AppLock>
        </FinanceProvider>
      </body>
    </html>
  );
}
