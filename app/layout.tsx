import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { BetaMarquee } from "@/components/layout/beta-marquee";
import { LaunchBetaPopup } from "@/components/layout/launch-beta-popup";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SnapCopy",
  description: "Lean Xerox and print-shop marketplace MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-slate-50 text-slate-900"
        suppressHydrationWarning
      >
        <AuthProvider>
          <BetaMarquee />
          <LaunchBetaPopup />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
