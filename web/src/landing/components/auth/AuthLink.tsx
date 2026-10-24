import type { AnchorHTMLAttributes, ReactNode } from "react";
import { AUTH_ROUTES, type AuthRouteKey } from "@lf/config/site";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "@lf/components/ui/button";

type AuthLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> & {
  route: AuthRouteKey;
  /** "plain" renders an unstyled text link (e.g. in the footer). */
  variant?: ButtonVariant | "plain";
  size?: ButtonSize;
  children: ReactNode;
};

/** Link to the app's real sign-up / log-in screens (see `AUTH_ROUTES` in `config/site.ts`). */
export function AuthLink({ route, variant = "primary", size = "md", className, children, ...rest }: AuthLinkProps) {
  return (
    <a {...rest} href={AUTH_ROUTES[route].href} className={variant === "plain" ? className : buttonStyles({ variant, size, className })}>
      {children}
    </a>
  );
}
