import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to know about the custom design tokens declared in
 * `src/index.css` (@theme). Otherwise a font-size token such as `text-title`
 * would be mistaken for a text colour and dropped when combined with
 * `text-evergreen`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "title", "lead", "eyebrow", "2xs", "3xs"],
      radius: ["control", "card", "panel"],
      shadow: ["card", "card-hover", "mockup", "button", "float"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
