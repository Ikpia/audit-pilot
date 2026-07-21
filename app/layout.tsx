import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditPilot",
  description: "Codex-powered audits for Solidity and Solana smart contracts"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
