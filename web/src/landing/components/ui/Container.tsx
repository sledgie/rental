import type { ReactNode } from "react";
import { cn } from "@lf/utils/cn";

interface ContainerProps {
  className?: string;
  children: ReactNode;
}

/** Consistent page gutters and maximum content width. */
export function Container({ className, children }: ContainerProps) {
  return <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8", className)}>{children}</div>;
}
