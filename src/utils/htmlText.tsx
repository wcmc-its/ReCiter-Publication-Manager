/**
 * Inline-HTML helpers for bibliographic text.
 *
 * PubMed-sourced article titles (and journal names) carry inline markup such as
 * `<i>KIAA0319L</i>`, `<sub>`, `<sup>`, `<b>`, and `&amp;` entities. ReCiterDB stores
 * both a plain `articleTitle` (which still contains the literal tag text) and an
 * HTML `articleTitleRTF` variant. Interpolating either as a React text child escapes
 * the markup, so the tags show literally in the UI ("...variations in <i>KIAA0319L</i>...").
 *
 * `sanitizeInlineHtml` renders that markup safely by RECONSTRUCTION: it keeps only a
 * tight whitelist of attribute-free inline formatting tags and drops everything else
 * (scripts, anchors, attributes, event handlers). This is dependency-free and
 * SSR-safe — no DOMPurify/jsdom, no `window`, identical output on server and client
 * (so no hydration mismatch). Pair it with `dangerouslySetInnerHTML`, e.g.
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(title) }} />
 *
 * `stripHtml` removes all tags and decodes a few common entities to plain text — use
 * it for spreadsheet exports, `title=` tooltips, and toasts where HTML can't render.
 */

// Attribute-free inline formatting only. No block, anchor, media, or script tags.
const ALLOWED_TAGS = new Set(['i', 'em', 'b', 'strong', 'sub', 'sup', 'u', 'span']);

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

/**
 * Return an HTML string containing ONLY whitelisted, attribute-free inline tags from
 * the input; all other tags are removed and text/entities are preserved. Safe to pass
 * to dangerouslySetInnerHTML.
 */
export function sanitizeInlineHtml(input?: string | null): string {
  if (input === undefined || input === null) return '';
  return String(input).replace(TAG_RE, (match, tag) => {
    const t = String(tag).toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    const closing = /^<\s*\//.test(match);
    return closing ? `</${t}>` : `<${t}>`;
  });
}

const ENTITY_MAP: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

/**
 * Strip all tags and decode common named/numeric entities to a plain-text string.
 * For exports, tooltips, and toasts.
 */
export function stripHtml(input?: string | null): string {
  if (input === undefined || input === null) return '';
  const noTags = String(input).replace(/<\/?[a-zA-Z][^>]*>/g, '');
  return noTags.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
    if (code[0] === '#') {
      const num = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : m;
    }
    const decoded = ENTITY_MAP[code.toLowerCase()];
    return decoded !== undefined ? decoded : m;
  });
}
