import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { isPublicReadonly } from "@/lib/app-mode";
import { siteConfig, siteRobots } from "@/lib/site";
import { CONSENT_TAKEOVER_ATTRIBUTE } from "@/lib/analytics/consent";
import "./globals.css";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    metadataBase: siteConfig.url,
    title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
    description: siteConfig.description,
    applicationName: siteConfig.name,
    robots: siteRobots(),
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: siteConfig.name,
      description: siteConfig.description,
      url: siteConfig.url,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary",
      title: siteConfig.name,
      description: siteConfig.description,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const appMode = isPublicReadonly() ? "public-readonly" : "editor";
  return (
    // Served with the consent takeover mark so the tag manager's own modal cannot flash before the app starts.
    <html lang="ko" {...{ [CONSENT_TAKEOVER_ATTRIBUTE]: "" }}>
      <body className="font-sans antialiased" data-app-mode={appMode}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
