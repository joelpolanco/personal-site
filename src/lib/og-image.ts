/**
 * Build-time OG image rendering: satori lays out a small element tree and
 * resvg rasterizes the SVG. Both run in Node during prerender, so nothing here
 * ships to the Cloudflare worker.
 *
 * The card is intentionally design-agnostic — black type on warm white, one
 * rule, no ornament — because the visual direction is not chosen yet. It reads
 * as deliberate today and is a small, isolated file to restyle later.
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

const INK = '#16150f';
const MUTED = '#5c574a';
const PAPER = '#faf8f3';

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
  /** Shown under the title: a date line for posts, a tagline otherwise. */
  eyebrow?: string | null;
};

type Element = {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
};

const el = (type: string, style: Record<string, unknown>, children?: unknown): Element => ({
  type,
  props: { style, children },
});

function card({ title, eyebrow }: OgImageInput): Element {
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
      el('div', { display: 'flex', flexDirection: 'column', gap: 24 }, [
        eyebrow
          ? el(
              'div',
              {
                display: 'flex',
                fontSize: 24,
                fontWeight: 400,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: MUTED,
              },
              clamp(eyebrow, 64),
            )
          : null,
        el(
          'div',
          { display: 'flex', fontSize: 60, fontWeight: 600, lineHeight: 1.15, letterSpacing: -1 },
          clamp(title, 120),
        ),
      ]),
      el('div', { display: 'flex', flexDirection: 'column', gap: 24 }, [
        el('div', { display: 'flex', width: '100%', height: 2, backgroundColor: INK }),
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
