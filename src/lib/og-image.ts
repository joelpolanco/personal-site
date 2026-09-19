/**
 * Build-time OG image rendering: satori lays out a small element tree and
 * resvg rasterizes the SVG. Both run in Node during prerender, so nothing here
 * ships to the Cloudflare worker.
 *
 * The card is the same idea as `PostCover.astro`, in a format Twitter and
 * LinkedIn can read: Swiss palette, the category as an accent eyebrow, the
 * title set tight, one rule.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { site } from '../config/site';

/**
 * Resolved from the working directory rather than `import.meta.url`: this
 * module is bundled into `dist/server/.prerender/` before it runs, so a path
 * relative to the module points at the wrong place. `astro build` always runs
 * from the project root.
 */
const fontsDir = path.resolve(process.cwd(), 'src/assets/fonts');

const WIDTH = 1200;
const HEIGHT = 630;

/* Mirrors the tokens in `global.css`; satori cannot read CSS custom properties. */
const INK = '#101010';
const MUTED = '#6e6e6e';
const PAPER = '#ffffff';
const ACCENT = '#c81c08';

let fontCache: Awaited<ReturnType<typeof loadFonts>> | null = null;

async function loadFonts() {
  const [regular, semibold] = await Promise.all(
    ['inter-latin-regular.ttf', 'inter-latin-semibold.ttf'].map(async (file) => {
      try {
        return await readFile(path.join(fontsDir, file));
      } catch {
        throw new Error(
          `OG image font ${file} not found in ${fontsDir}. ` +
            'Run the build from the project root, and see README "Open graph images".',
        );
      }
    }),
  );
  return [
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: semibold, weight: 600 as const, style: 'normal' as const },
  ];
}

/**
 * satori has no text-overflow support, so long titles are trimmed to something
 * that reliably fits three lines at 60px.
 */
function clamp(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}\u2026`;
}

export type OgImageInput = {
  title: string;
  /** Accent line above the title: the category for posts, a tagline otherwise. */
  eyebrow?: string | null;
  /** Muted line opposite the eyebrow, e.g. the publication date. */
  meta?: string | null;
};

type Element = {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
};

const el = (type: string, style: Record<string, unknown>, children?: unknown): Element => ({
  type,
  props: { style, children },
});

function card({ title, eyebrow, meta }: OgImageInput): Element {
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: '100%',
      height: '100%',
      padding: '72px 80px',
      backgroundColor: PAPER,
      color: INK,
      fontFamily: 'Inter',
    },
    [
      el('div', { display: 'flex', flexDirection: 'column', gap: 28 }, [
        el(
          'div',
          {
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: 'uppercase',
          },
          [
            el('div', { display: 'flex', color: ACCENT }, eyebrow ? clamp(eyebrow, 48) : ''),
            el('div', { display: 'flex', color: MUTED }, meta ? clamp(meta, 32) : ''),
          ],
        ),
        el(
          'div',
          { display: 'flex', fontSize: 62, fontWeight: 600, lineHeight: 1.1, letterSpacing: -2 },
          clamp(title, 120),
        ),
      ]),
      el('div', { display: 'flex', flexDirection: 'column', gap: 24 }, [
        el('div', { display: 'flex', width: '100%', height: 3, backgroundColor: ACCENT }),
        el('div', { display: 'flex', justifyContent: 'space-between', fontSize: 26 }, [
          el('div', { display: 'flex', fontWeight: 600 }, site.name),
          el('div', { display: 'flex', color: MUTED }, site.url.replace('https://', '')),
        ]),
      ]),
    ],
  );
}

/** Render one 1200×630 PNG. Fonts are read once per build. */
export async function renderOgImage(input: OgImageInput): Promise<Uint8Array> {
  fontCache ??= await loadFonts();
  const svg = await satori(card(input) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: fontCache,
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
}
