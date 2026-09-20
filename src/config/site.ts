/**
 * Site-wide identity used by the SEO layer: canonical URLs, feed metadata,
 * structured data and OG images. Deliberately separate from anything a design
 * direction owns, so picking a direction does not touch it.
 */
export const site = {
  url: 'https://joelpolanco.me',
  name: 'Joel Polanco',
  title: 'Joel Polanco',
  /** Used as the RSS channel description and the default meta description. */
  description:
    'Joel Polanco is a senior product manager writing about product management, customer discovery, and the move from engineering into product.',
  language: 'en-us',
  locale: 'en_US',
} as const;

/**
 * The `Person` behind the site. `sameAs` is what tells Google the profiles and
 * the site are the same entity, so keep it to profiles Joel actually controls.
 */
export const person = {
  name: 'Joel Polanco',
  jobTitle: 'Senior Product Manager',
  description:
    'Senior product manager in Intel\u2019s Edge Computing Group. Writes about product management and coaches technical founders on customer discovery.',
  url: site.url,
  /**
   * RSS puts `managingEditor` and per-item `author` in public XML, so this
   * stays null until Joel picks an address he is happy to publish. The contact
   * form does not use it — that delivers to `CONTACT_TO_EMAIL`.
   */
  email: null as string | null,
  sameAs: [
    'https://www.linkedin.com/in/jpolanco',
    'https://blog.logrocket.com/author/joelpolanco/',
  ],
  worksFor: { name: 'Intel', url: 'https://www.intel.com' },
} as const;

/** Primary navigation, in header and footer order. */
export const nav = [
  { label: 'Home', href: '/' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Blog', href: '/blog' },
  { label: 'Media', href: '/media' },
  { label: 'Resources', href: '/resources' },
  { label: 'Contact', href: '/contact' },
] as const;

export const footerLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jpolanco', external: true },
  { label: 'LogRocket blog', href: 'https://blog.logrocket.com/author/joelpolanco/', external: true },
] as const;

/** Legacy Wix URLs that must keep resolving after cutover. */
export const legacyRedirects = {
  '/contact-6': '/contact',
  /** An unfinished Wix template page with no portfolio entry of its own. */
  '/project-1': '/portfolio',
} as const;

/** The RSS path Wix used. Existing subscribers poll it, so it cannot move. */
export const FEED_PATH = '/blog-feed.xml';

/** Absolute URL for a site-relative path. */
export function absoluteUrl(pathname: string): string {
  return new URL(pathname, site.url).href;
}

/** The OG image route for a post, or the site-wide fallback. */
export function ogImagePath(slug?: string): string {
  return `/og/${slug ?? 'default'}.png`;
}
