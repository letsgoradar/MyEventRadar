import sanitizeHtml from "sanitize-html";

const SAFE_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    span: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
  },
};

const STRIP_ALL_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, SAFE_HTML_OPTIONS);
}

export function stripHtml(html: string): string {
  return sanitizeHtml(html, STRIP_ALL_OPTIONS).trim();
}

export function sanitizeUserInput(text: string, maxLength = 10000): string {
  if (!text || typeof text !== "string") return "";
  return stripHtml(text).slice(0, maxLength);
}
