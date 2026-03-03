import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeInspectAI",
  description: "Upload inspection PDFs and get a prioritized repair dashboard."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
