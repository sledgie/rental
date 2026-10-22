import type { ReactNode } from "react";
import { toHref, useRoute } from "./route";

/** Drop-in for next/link: original paths become hash routes of the Bank Reconciliation page. */
export default function Link({ href, children }: { href: string; children?: ReactNode }) {
  const route = useRoute();
  return <a href={toHref(href, route)} style={{ textDecoration: "none", color: "inherit" }}>{children}</a>;
}
