/**
 * Joel's real homepage content, transcribed from joelpolanco.me.
 * Every design direction renders from this single source so the comparison
 * is purely about design, never about differences in copy.
 */

export type TextRun = {
  readonly text: string;
  readonly emphasis?: boolean;
  readonly href?: string;
};

export const site = {
  name: 'Joel Polanco',
  title: 'Joel Polanco',
  tagline: 'Senior Product Manager',
  url: 'https://joelpolanco.me',
  copyright: '\u00A92024 by Joel Polanco',
  linkedin: 'https://www.linkedin.com/in/joelpolanco',
} as const;

export const nav = [
  { label: 'Home', href: '/' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Blog', href: '/blog' },
  { label: 'Media', href: '/media' },
  { label: 'Resources', href: '/resources' },
  { label: 'Contact', href: '/contact' },
] as const;

/**
 * `intro` and `now` are rendered as runs of segments so each direction can style
 * the emphasized phrases with its own accent treatment.
 */
export const hero: {
  greeting: string;
  name: string;
  intro: readonly TextRun[];
  now: readonly TextRun[];
  cta: { label: string; href: string };
} = {
  greeting: "Hi, I'm",
  name: 'Joel Polanco',
  intro: [
    { text: "I'm a " },
    { text: 'senior product manager', emphasis: true },
    {
      text:
        ' who loves to solve hard problems, meet new people, and have some fun along the way. ' +
        "I'm a big fan of slash careers and pursuing one's passions through side bets.",
    },
  ],
  now: [
    { text: "Currently, I'm " },
    { text: 'writing about product management', emphasis: true, href: '/blog' },
    { text: ', advising a pre-seed ' },
    { text: 'battery startup', emphasis: true },
    { text: ', and ' },
    { text: 'coaching future founders', emphasis: true },
    { text: ' on customer discovery.' },
  ],
  cta: { label: 'Check out my blog', href: '/blog' },
};

export const background: {
  eyebrow: string;
  heading: string;
  body: readonly (readonly TextRun[])[];
} = {
  eyebrow: 'My',
  heading: 'Background',
  body: [
    [
      { text: "I started out my career as a semiconductor fab process engineer. I'm an engineer at heart but have a " },
      { text: 'passion for business and technology', emphasis: true },
      { text: '.' },
    ],
    [
      {
        text:
          'After I earned my MBA, I moved into several analyst roles before making a home in product management. ' +
          "I'm most comfortable when I am working with engineers developing scalable solutions to customer problems.",
      },
    ],
  ],
};

export const currentRole = {
  eyebrow: 'My',
  heading: 'Current Role',
  title: 'Senior Product Manager',
  body: [
    "I'm currently a product manager in the Edge Computing Group at Intel. I work on an industry solutions team and am responsible for Intel's retail point-of-sale business.",
    'My other interests include personal finance, investing, reading, writing, and advising future founders on customer discovery.',
  ],
  cta: { label: 'View my LinkedIn', href: site.linkedin },
} as const;

export const skills = {
  eyebrow: 'My',
  heading: 'Skills',
  items: [
    {
      number: '01',
      title: 'Product Management.',
      lead: 'B2B',
      rest: ', IoT, Analytics & Semiconductor',
    },
    {
      number: '02',
      title: 'Business Strategy.',
      lead: 'Computing',
      rest: ', IoT, IT & OT',
    },
    {
      number: '03',
      title: 'Customer Discovery.',
      lead: 'Hardware',
      rest: ', software, & cleantech',
    },
    {
      number: '04',
      title: 'Content marketing.',
      lead: 'Product management',
      rest: ', growth & technology trends',
    },
  ],
} as const;

export const testimonial = {
  quote:
    'Our company faced an overwhelming amount of information. From the customer discovery plan to the detailed methods of analysis, Joel\u2019s expertise was evident every step of the way.',
  author: 'Marie Eric',
  role: 'Co-Founder',
  company: 'Tastee Tape',
} as const;

export const footer = {
  connect: 'Connect with me on',
} as const;
