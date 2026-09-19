/**
 * Shared post queries. The blog index, the category pages, the homepage and
 * the feed all want the same "published, newest first" list, and the ordering
 * has to agree between them for previous/next links to make sense.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { categories, type CategoryId } from '../config/categories';

export type Post = CollectionEntry<'posts'>;

/** Every published post, newest first. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export function countByCategory(posts: Post[]): Record<CategoryId, number> {
  const counts = Object.fromEntries(categories.map((category) => [category.id, 0])) as Record<
    CategoryId,
    number
  >;
  for (const post of posts) counts[post.data.category] += 1;
  return counts;
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}
