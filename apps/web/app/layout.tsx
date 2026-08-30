import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { isPublicReadonly } from "@/lib/app-mode";
import { siteConfig, siteRobots } from "@/lib/site";
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
    <html lang="ko">
      <body className="font-sans antialiased" data-app-mode={appMode}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
