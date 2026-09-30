import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JA MAKER — Automations créatives",
  description: "Créez, planifiez et pilotez vos contenus depuis un seul espace.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/jamaker-icon.svg", apple: "/jamaker-icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
