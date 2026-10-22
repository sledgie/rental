import { renderPreview } from "./engine";
import type { MessageTemplate, PreviewResult, TemplateInput } from "./types";

const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "A", "H1", "H2", "H3", "BLOCKQUOTE", "DIV", "SPAN", "HR"]);
const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "TEMPLATE"]);
const ALLOWED_CLASSES: Record<string, string[]> = { DIV: ["email-signature"], SPAN: ["missing-value"] };

function safeHref(value: string) {
  const trimmed = value.trim();
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(trimmed) ? trimmed : "";
}

/** Browser replacement for the original server-side sanitize-html pass: same tag, attribute and scheme allow-lists. */
export function sanitizeMessageHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const element of [...document.body.querySelectorAll("*")].reverse()) {
    if (DROP_WITH_CONTENT.has(element.tagName)) { element.remove(); continue; }
    if (!ALLOWED_TAGS.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (element.tagName === "A" && name === "href") {
        const href = safeHref(attribute.value);
        if (href) element.setAttribute("href", href); else element.removeAttribute("href");
      } else if (element.tagName === "A" && name === "title") continue;
      else if (name === "class" && ALLOWED_CLASSES[element.tagName]) {
        const kept = attribute.value.split(/\s+/).filter((item) => ALLOWED_CLASSES[element.tagName].includes(item));
        if (kept.length) element.setAttribute("class", kept.join(" ")); else element.removeAttribute("class");
      } else element.removeAttribute(attribute.name);
    }
    if (element.tagName === "A" && element.hasAttribute("href")) { element.setAttribute("target", "_blank"); element.setAttribute("rel", "noopener noreferrer"); }
  }
  return document.body.innerHTML;
}

export function previewTemplate(payload: { template: MessageTemplate | TemplateInput; scenarioId?: string }): PreviewResult {
  const scenarioId = payload.scenarioId ?? "rent";
  const initial = renderPreview(payload.template, scenarioId);
  return renderPreview(payload.template, scenarioId, sanitizeMessageHtml(initial.renderedBody));
}
