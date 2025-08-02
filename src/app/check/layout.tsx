import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DEFAI Airdrop Checker",
  description: "Check your DEFAI airdrop allocation",
};

export default function CheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 