/**
 * The blog feed, kept at the exact path Wix served it from. Existing
 * subscribers poll `/blog-feed.xml` and have no way to learn about a new URL,
 * so this route is as load-bearing as the `/post/<slug>` URLs.
 *
 * Items carry title, description and link rather than full article HTML,
 * matching what the Wix feed shipped — readers that showed a summary before
 * keep showing a summary, with no sudden change in how the feed reads.
 */
import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site, person, absoluteUrl, FEED_PATH } from '../config/site';

export const prerender = true;

export const GET: APIRoute = async (context) => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  return rss({
    title: `${site.name} \u2014 Blog`,
    description: site.description,
    site: context.site ?? site.url,
    trailingSlash: false,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: [
      `<language>${site.language}</language>`,
      // RSS wants an email here; omitted rather than published as a guess.
      person.email ? `<managingEditor>${person.email} (${person.name})</managingEditor>` : '',
      `<atom:link href="${absoluteUrl(FEED_PATH)}" rel="self" type="application/rss+xml"/>`,
    ].join(''),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/post/${post.id}`,
      ...(person.email ? { author: `${person.email} (${post.data.author})` } : {}),
    })),
  });
};
