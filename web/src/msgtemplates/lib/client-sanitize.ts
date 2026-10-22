const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "A", "H1", "H2", "H3", "BLOCKQUOTE", "DIV", "SPAN", "HR"]);
const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "TEMPLATE"]);

function safeHref(value: string) {
  const trimmed = value.trim();
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(trimmed) ? trimmed : "";
}

/** Sanitizes editor HTML before it is assigned to a live contentEditable DOM. */
export function sanitizeEditorHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const elements = [...document.body.querySelectorAll("*")].reverse();
  for (const element of elements) {
    if (DROP_WITH_CONTENT.has(element.tagName)) { element.remove(); continue; }
    if (!ALLOWED_TAGS.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (element.tagName === "A" && name === "href") {
        const href = safeHref(attribute.value);
        if (href) element.setAttribute("href", href); else element.removeAttribute("href");
      } else if (element.tagName === "A" && name === "title") continue;
      else element.removeAttribute(attribute.name);
    }
    if (element.tagName === "A" && element.hasAttribute("href")) { element.setAttribute("target", "_blank"); element.setAttribute("rel", "noopener noreferrer"); }
  }
  return document.body.innerHTML;
}
