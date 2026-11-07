import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";

// Forum: Roman inscriptional capitals, in step with the colonnaded facade. Golos Text: drawn for Cyrillic UI.
// Self-hosted: next/font/google fails the Turbopack build whenever Google answers with a font URL containing "&".
const forum = localFont({
  src: "./fonts/Forum-Regular.woff2",
  variable: "--font-forum",
  weight: "400",
  adjustFontFallback: "Times New Roman",
});
const golos = localFont({
  src: "./fonts/GolosText-Variable.woff2",
  variable: "--font-golos",
  weight: "400 600",
});

export const metadata: Metadata = {
  title: "Yakka Saroy — банкетный зал и ресторан в Ташкенте",
  description:
    "Yakka Saroy в Яккасарайском районе Ташкента: банкетные залы на 20–800 гостей и ресторан. Проверьте свободные даты и оставьте заявку онлайн.",
  openGraph: {
    title: "Yakka Saroy — дворец торжеств",
    description: "Свадьбы, никох, юбилеи и ужины. Свободные даты онлайн.",
    locale: "ru_RU",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={cn("h-full antialiased font-sans", forum.variable, golos.variable)}>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
