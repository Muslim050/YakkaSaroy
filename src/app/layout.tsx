import type { Metadata } from "next";
import { Forum, Golos_Text } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Forum: Roman inscriptional capitals, in step with the colonnaded facade. Golos Text: drawn for Cyrillic UI.
const forum = Forum({ variable: "--font-forum", subsets: ["latin", "cyrillic"], weight: "400" });
const golos = Golos_Text({ variable: "--font-golos", subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Yakka Saroy — банкетный зал и ресторан в Ташкенте",
  description:
    "Yakka Saroy в Яккасарайском районе Ташкента: банкетные залы на 40–800 гостей и ресторан. Проверьте свободные даты и оставьте заявку онлайн.",
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
