import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Chess.MR - منصة الشطرنج الموريتانية",
    template: "%s | Chess.MR",
  },
  description:
    "المنصة الرسمية للشطرنج في موريتانيا - تبعيات، نتائج مباشرة، وإحصائيات اللاعبين",
  keywords: [
    "شطرنج",
    "موريتانيا",
    "Chess",
    "Mauritania",
    "تournament",
    "لاعب شطرنج",
  ],
  authors: [{ name: "Chess Federation of Mauritania" }],
  openGraph: {
    type: "website",
    locale: "ar_MR",
    alternateLocale: "en_US",
    siteName: "Chess.MR",
    title: "Chess.MR - منصة الشطرنج الموريتانية",
    description:
      "المنصة الرسمية للشطرنج في موريتانيا - تبعيات، نتائج مباشرة، وإحصائيات اللاعبين",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chess.MR - منصة الشطرنج الموريتانية",
    description:
      "المنصة الرسمية للشطرنج في موريتانيا",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${ibmPlexArabic.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
