import type { AnchorHTMLAttributes, ReactNode } from "react";
import { toHref, useRoute } from "./store";
import { downloadReportCsv } from "../lib/deposits/export";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children?: ReactNode; prefetch?: boolean; scroll?: boolean };

/** Drop-in for next/link: original paths become hash routes of the Deposits page. */
export default function Link({ href, children, prefetch: _p, scroll: _s, onClick, ...rest }: Props) {
  const route = useRoute();
  if (href.startsWith("/api/deposits/export")) {
    return (
      <a
        href="#"
        {...rest}
        onClick={(e) => {
          e.preventDefault();
          onClick?.(e);
          void downloadReportCsv(Object.fromEntries(new URL(href, "http://x").searchParams));
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <a href={toHref(href, route)} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
