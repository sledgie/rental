import { useEffect, useRef, useState } from "react";
import { ChevronRight, Menu, X } from "lucide-react";
import { NAV_ITEMS, NAV_SECTION_IDS } from "@lf/config/site";
import { useScrolled } from "@lf/hooks/useScrolled";
import { useActiveSection } from "@lf/hooks/useActiveSection";
import { Container } from "@lf/components/ui/Container";
import { Wordmark } from "@lf/components/brand/Logo";
import { AuthLink } from "@lf/components/auth/AuthLink";
import { cn } from "@lf/utils/cn";

export function Header() {
  const scrolled = useScrolled(8);
  const activeSection = useActiveSection(NAV_SECTION_IDS);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mobile menu: lock scroll, make the page behind inert, handle Escape and
  // close automatically when the viewport grows to the desktop layout.
  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    const background = [document.getElementById("main-content"), document.getElementById("site-footer")];
    background.forEach((element) => element?.setAttribute("inert", ""));

    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onBreakpoint);

    return () => {
      root.style.overflow = previousOverflow;
      background.forEach((element) => element?.removeAttribute("inert"));
      window.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300",
          scrolled || open
            ? "border-line bg-ivory/90 shadow-[0_8px_24px_-18px_rgb(18_61_50/0.25)] backdrop-blur-md"
            : "border-transparent bg-ivory/0",
        )}
      >
        <a
          href="#main-content"
          className="sr-only rounded-control bg-evergreen px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60]"
        >
          Skip to content
        </a>

        <Container className="flex h-16 items-center justify-between gap-6">
          <a href="#top" aria-label="L.O.F.T. — back to top" className="-m-1 rounded-control p-1" onClick={closeMenu}>
            <Wordmark />
          </a>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                const current = activeSection === item.id;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      aria-current={current ? "true" : undefined}
                      className={cn(
                        "relative block rounded-control px-3 py-2 text-[0.9375rem] font-medium transition-colors duration-200",
                        current ? "text-evergreen" : "text-ink/70 hover:text-evergreen",
                      )}
                    >
                      {item.label}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-x-3 bottom-0.5 h-0.5 origin-left rounded-full bg-forest transition-transform duration-300",
                          current ? "scale-x-100" : "scale-x-0",
                        )}
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="hidden items-center gap-1.5 lg:flex">
            <AuthLink route="login" variant="ghost" size="sm">
              Log In
            </AuthLink>
            <AuthLink route="signup" size="sm">
              Start Free
            </AuthLink>
          </div>

          <button
            ref={toggleRef}
            type="button"
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-control text-evergreen transition-colors hover:bg-evergreen/[0.06] lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </Container>
      </header>

      {/* Rendered outside <header> so the header's backdrop-filter doesn't become its containing block. */}
      <div
        id="mobile-menu"
        ref={panelRef}
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-ivory animate-fade-up lg:hidden"
      >
        <Container className="flex min-h-full flex-col pb-8 pt-4">
          <nav aria-label="Mobile">
            <ul className="divide-y divide-line border-b border-line">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={closeMenu}
                    aria-current={activeSection === item.id ? "true" : undefined}
                    className="flex min-h-14 items-center justify-between text-lg font-medium text-evergreen"
                  >
                    {item.label}
                    <ChevronRight className="size-5 text-muted" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto grid gap-3 pt-10">
            <AuthLink route="signup" size="lg" onClick={closeMenu}>
              Start Free
            </AuthLink>
            <AuthLink route="login" variant="secondary" size="lg" onClick={closeMenu}>
              Log In
            </AuthLink>
          </div>
        </Container>
      </div>
    </>
  );
}
