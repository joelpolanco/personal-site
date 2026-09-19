/**
 * Renders the short markdown strings held in the page datasets — links, bold,
 * italic, inline code — to HTML.
 *
 * Deliberately not a markdown library: these are single sentences and phrases
 * in JSON, not documents. Blog posts go through the real MDX pipeline. Input
 * is escaped first, so a stray `<` in Joel's copy is text, not markup.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] as string);
}

/** Anything not on our own origin opens in a new tab and is marked as such. */
function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href) && !href.includes('joelpolanco.me');
}

export type InlineMarkdownOptions = {
  /** Class applied to links, so a template can use its own accent treatment. */
  linkClass?: string;
  /** Class applied to `**bold**` runs. */
  strongClass?: string;
};

export function renderInline(markdown: string, options: InlineMarkdownOptions = {}): string {
  const { linkClass, strongClass } = options;
  const linkAttr = linkClass ? ` class="${escapeHtml(linkClass)}"` : '';
  const strongAttr = strongClass ? ` class="${escapeHtml(strongClass)}"` : '';

  return escapeHtml(markdown)
    .replace(/\[([^\]]+)]\(([^)\s]+)\)/g, (_match, text: string, href: string) => {
      const external = isExternal(href);
      const rel = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${href}"${linkAttr}${rel}>${text}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, `<strong${strongAttr}>$1</strong>`)
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Markdown stripped to plain text, for meta descriptions and anywhere else
 * markup would leak into an attribute.
 */
export function stripInline(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)]\([^)\s]+\)/g, '$1')
    .replace(/[*`]/g, '')
    .trim();
}
