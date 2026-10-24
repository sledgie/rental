import { useEffect } from "react";
import { Header } from "@lf/components/sections/Header";
import { Hero } from "@lf/components/sections/Hero";
import { ProblemSolution } from "@lf/components/sections/ProblemSolution";
import { Showcase } from "@lf/components/sections/Showcase";
import { Accounting } from "@lf/components/sections/Accounting";
import { Features } from "@lf/components/sections/Features";
import { HowItWorks } from "@lf/components/sections/HowItWorks";
import { Teams } from "@lf/components/sections/Teams";
import { Security } from "@lf/components/sections/Security";
import { Audience } from "@lf/components/sections/Audience";
import { FinalCta } from "@lf/components/sections/FinalCta";
import { Footer } from "@lf/components/sections/Footer";
// The landing page ships its own Tailwind build (with a reset) that must not touch the app, so it is loaded as text and
// attached to the document only while this page is on screen.
import landingCss from "./landing.css?inline";

const TITLE = "L.O.F.T. | Rental Property Management and Accounting Software";

/** In-page links (#platform, #top ...) must scroll instead of changing the app's hash route (#/login ...). */
function scrollToSection(event: MouseEvent) {
  const link = (event.target as Element | null)?.closest?.("a[href^='#']");
  const href = link?.getAttribute("href") ?? "";
  if (!link || href.startsWith("#/") || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
  event.preventDefault();
  const id = href.slice(1);
  if (id === "top") return window.scrollTo({ top: 0, behavior: "smooth" });
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  if (id === "main-content") target.focus({ preventScroll: true });
}

/** L.O.F.T. marketing page, shown to visitors who are not signed in. */
export default function Landing() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.landing = "";
    style.textContent = landingCss;
    document.head.appendChild(style);
    const previousTitle = document.title;
    document.title = TITLE;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousColor = meta?.content;
    if (meta) meta.content = "#123D32";
    window.scrollTo(0, 0);
    document.addEventListener("click", scrollToSection);
    return () => {
      document.removeEventListener("click", scrollToSection);
      style.remove();
      document.title = previousTitle;
      if (meta && previousColor) meta.content = previousColor;
    };
  }, []);

  return (
    <div className="lf-root">
      <Header />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <ProblemSolution />
        <Showcase />
        <Accounting />
        <Features />
        <HowItWorks />
        <Teams />
        <Security />
        <Audience />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
