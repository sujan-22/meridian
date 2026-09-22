/**
 * Bakes the background starfield into `public/constellation.svg`.
 *
 * The field is static - it is a texture, not an animation - so there is no
 * reason to make every visitor's machine compute it. It is generated once,
 * here, and committed as a plain SVG that the browser can cache.
 *
 * The numbers below are the taste dial. `FIELD_OPACITY` is the one to reach
 * for first: the field should read as grain you notice only when you look
 * for it, never as a picture competing with the week grid in front of it.
 *
 *   pnpm constellation
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const WIDTH = 1600;
const HEIGHT = 1000;

/** Everything is multiplied by this at the end. The restraint lives here. */
const FIELD_OPACITY = 0.85;

/** Loose scatter across the whole field, so it never looks like a pattern. */
const SCATTER_COUNT = 104;

/**
 * Clusters give the field somewhere to be dense, which is what makes it read
 * as a constellation rather than as noise. They dodge the two places text
 * actually sits: the middle, where the grid and the cards are, and the top
 * left corner, where the sidebar nav is. The first cluster is placed in the
 * empty sidebar below the nav, which is the one large open surface the app
 * has and the only place the field is properly visible.
 *
 * They are also kept clear of the top and bottom edges, because the field is
 * drawn `cover` and a taller-than-16:10 display crops those bands away.
 */
const CLUSTERS = [
    { x: 0.13, y: 0.52, spread: 0.1, count: 34 },
    { x: 0.83, y: 0.7, spread: 0.11, count: 30 },
    { x: 0.62, y: 0.17, spread: 0.08, count: 18 },
    { x: 0.34, y: 0.84, spread: 0.09, count: 20 },
];

/** Two points closer than this may be joined. */
const LINK_DISTANCE = 118;

/**
 * Two lines per node at most. At three the field triangulates into a web,
 * which reads as busy; at two it falls into chains, which is what a
 * constellation actually looks like.
 */
const MAX_DEGREE = 2;

/** Dropping a share of the eligible lines keeps the mesh from webbing up. */
const LINK_KEEP = 0.5;

/** Reproducible: the same seed gives the same sky every time. */
const SEED = 0x5eed17;

interface Point {
    x: number;
    y: number;
    /** How many neighbours sit within `LINK_DISTANCE`. Drives brightness. */
    density: number;
    degree: number;
}

/** mulberry32 - small, fast, and good enough for scattering dots. */
function makeRandom(seed: number): () => number {
    let a = seed >>> 0;

    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const random = makeRandom(SEED);

/** Box-Muller, so clusters fall off smoothly instead of ending at a rim. */
function gaussian(): number {
    const u = 1 - random();
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function round(value: number, places = 1): string {
    return Number(value.toFixed(places)).toString();
}

const points: Point[] = [];

for (let i = 0; i < SCATTER_COUNT; i++) {
    points.push({
        x: random() * WIDTH,
        y: random() * HEIGHT,
        density: 0,
        degree: 0,
    });
}

for (const cluster of CLUSTERS) {
    for (let i = 0; i < cluster.count; i++) {
        const x = (cluster.x + gaussian() * cluster.spread) * WIDTH;
        const y = (cluster.y + gaussian() * cluster.spread) * HEIGHT;

        // A point off the edge would only be half-drawn, so drop it rather
        // than clamping it - clamping piles points up along the border.
        if (x < 0 || x > WIDTH || y < 0 || y > HEIGHT) continue;

        points.push({ x, y, density: 0, degree: 0 });
    }
}

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
        if (distance(points[i], points[j]) < LINK_DISTANCE) {
            points[i].density++;
            points[j].density++;
        }
    }
}

// Nearest pairs first, so the lines that do survive are the short, tight ones
// a constellation is actually made of.
const candidates: Array<{ a: number; b: number; length: number }> = [];

for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
        const length = distance(points[i], points[j]);
        if (length < LINK_DISTANCE) candidates.push({ a: i, b: j, length });
    }
}

candidates.sort((left, right) => left.length - right.length);

const lines: string[] = [];

for (const { a, b, length } of candidates) {
    if (points[a].degree >= MAX_DEGREE || points[b].degree >= MAX_DEGREE) {
        continue;
    }

    if (random() > LINK_KEEP) continue;

    points[a].degree++;
    points[b].degree++;

    // Short lines are the bright filaments; long ones trail off to nothing.
    const nearness = 1 - length / LINK_DISTANCE;
    const opacity = (0.05 + nearness * 0.13) * FIELD_OPACITY;

    lines.push(
        `<line x1="${round(points[a].x)}" y1="${round(points[a].y)}" ` +
            `x2="${round(points[b].x)}" y2="${round(points[b].y)}" ` +
            `stroke-opacity="${round(opacity, 3)}"/>`,
    );
}

const dots = points.map((point) => {
    // Points in the thick of it sit brighter, which is what gives the field
    // its glowing cores instead of one flat wash of dots.
    const crowding = Math.min(point.density / 6, 1);
    const radius = 0.9 + crowding * 1.1 + random() * 0.35;
    const opacity = (0.16 + crowding * 0.34 + random() * 0.1) * FIELD_OPACITY;

    return (
        `<circle cx="${round(point.x)}" cy="${round(point.y)}" ` +
        `r="${round(radius, 2)}" fill-opacity="${round(opacity, 3)}"/>`
    );
});

/**
 * The fade is the other half of "not too over". The field is dimmest through
 * the middle, where the cards and the grid sit, and strongest in the outer
 * third - so it surrounds the work rather than showing through it - then
 * drops away again at the corners so it never ends on a hard edge.
 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="fade" cx="50%" cy="46%" r="72%">
      <stop offset="0" stop-color="#262626"/>
      <stop offset="0.42" stop-color="#8c8c8c"/>
      <stop offset="0.74" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#2e2e2e"/>
    </radialGradient>
    <mask id="fade-mask">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fade)"/>
    </mask>
  </defs>

  <g mask="url(#fade-mask)">
    <g stroke="#ffffff" stroke-width="0.6">
${lines.map((line) => `      ${line}`).join("\n")}
    </g>
    <g fill="#ffffff">
${dots.map((dot) => `      ${dot}`).join("\n")}
    </g>
  </g>
</svg>
`;

const target = join(process.cwd(), "public", "constellation.svg");
writeFileSync(target, svg, "utf8");

console.log(
    `Wrote ${target} - ${points.length} points, ${lines.length} lines, ` +
        `${(svg.length / 1024).toFixed(1)}kb`,
);
