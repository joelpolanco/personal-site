/**
 * Blog taxonomy.
 *
 * Wix exposed no categories or tags at all, so this was invented from the 23
 * posts rather than migrated. Six buckets, every post in exactly one, none
 * with fewer than three posts — a taxonomy with a one-post category is just a
 * tag pretending to be a section.
 *
 * `id` is the URL segment at `/blog/<id>`. Changing one is a URL change, so
 * treat these as fixed once published.
 */
export const categories = [
  {
    id: 'customer-discovery',
    number: '01',
    name: 'Customer Discovery',
    summary: 'Talking to customers before you build, and what to do with what they tell you.',
  },
  {
    id: 'growth-and-revenue',
    number: '02',
    name: 'Growth & Revenue',
    summary: 'Acquisition, retention, pricing and the mechanics of how products make money.',
  },
  {
    id: 'frameworks-and-process',
    number: '03',
    name: 'Frameworks & Process',
    summary: 'The frameworks and rituals worth keeping, and how to avoid cargo-culting them.',
  },
  {
    id: 'communication-and-craft',
    number: '04',
    name: 'Communication & Craft',
    summary: 'Writing, listening and judgement — the parts of the job no framework covers.',
  },
  {
    id: 'the-pm-career',
    number: '05',
    name: 'The PM Career',
    summary: 'Career paths, lateral moves and what the role is actually turning into.',
  },
  {
    id: 'industry-and-ai',
    number: '06',
    name: 'Industry & AI',
    summary: 'Launches, org shake-ups, and hands-on experiments with AI tooling.',
  },
] as const;

export type CategoryId = (typeof categories)[number]['id'];

export const categoryIds = categories.map((category) => category.id) as [CategoryId, ...CategoryId[]];

const byId = new Map(categories.map((category) => [category.id, category]));

export function getCategory(id: CategoryId) {
  const category = byId.get(id);
  if (!category) throw new Error(`Unknown category "${id}"`);
  return category;
}
