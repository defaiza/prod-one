import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DEFAI Airdrop Checker",
  description: "Check your DEFAI airdrop allocation",
};

export default function CheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <head />
      <body>
        {children}
      </body>
    </html>
  );
} 