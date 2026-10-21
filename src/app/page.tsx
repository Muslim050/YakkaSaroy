import { About } from "@/components/About";
import { Booking } from "@/components/Booking";
import { Contacts } from "@/components/Contacts";
import { Footer } from "@/components/Footer";
import { Gallery } from "@/components/Gallery";
import { Halls } from "@/components/Halls";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Menu } from "@/components/Menu";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <Halls />
        <Menu />
        <Gallery />
        <Booking />
        <Contacts />
      </main>
      <Footer />
    </>
  );
}
