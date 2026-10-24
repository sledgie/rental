import {
  FOOTER_COMPANY_LINKS,
  FOOTER_EXPLORE_LINKS,
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  SITE_TAGLINE,
  type FooterLink,
} from "@lf/config/site";
import { Container } from "@lf/components/ui/Container";
import { Wordmark } from "@lf/components/brand/Logo";
import { AuthLink } from "@lf/components/auth/AuthLink";

const LINK_CLASS = "rounded-sm text-muted transition-colors duration-200 hover:text-evergreen";

/** Only pages that actually exist (have an href) are rendered. */
const published = (links: FooterLink[]) => links.filter((link): link is Required<FooterLink> => Boolean(link.href));

function FooterColumn({ title, links }: { title: string; links: Required<FooterLink>[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-evergreen">{title}</h2>
      <ul className="mt-4 space-y-3 text-[0.9375rem]">
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href} className={LINK_CLASS}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  const companyLinks = published(FOOTER_COMPANY_LINKS);
  const legalLinks = published(FOOTER_LEGAL_LINKS);

  return (
    <footer id="site-footer" className="border-t border-line bg-ivory">
      <Container className="py-14 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <a href="#top" aria-label="L.O.F.T. — back to top" className="inline-block rounded-control">
              <Wordmark />
            </a>
            <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-muted">{SITE_TAGLINE}</p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-4">
            <FooterColumn title="Product" links={published(FOOTER_PRODUCT_LINKS)} />
            <FooterColumn title="Explore" links={published(FOOTER_EXPLORE_LINKS)} />
            <div>
              <h2 className="text-sm font-semibold text-evergreen">Account</h2>
              <ul className="mt-4 space-y-3 text-[0.9375rem]">
                <li>
                  <AuthLink route="login" variant="plain" className={LINK_CLASS}>
                    Log In
                  </AuthLink>
                </li>
                <li>
                  <AuthLink route="signup" variant="plain" className={LINK_CLASS}>
                    Sign Up
                  </AuthLink>
                </li>
              </ul>
            </div>
            {companyLinks.length > 0 && <FooterColumn title="Company" links={companyLinks} />}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <p>
            &copy; {year} {"L.O.F.T."} All rights reserved.
          </p>
          {legalLinks.length > 0 && (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p>Product previews use illustrative sample data.</p>
        </div>
      </Container>
    </footer>
  );
}
