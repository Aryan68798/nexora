import { describe, it, expect } from 'vitest';
import { lintSource } from '../../scripts/design-lint.js';

describe('Design Linter Unit Tests (Fixture Strings)', () => {
  it('detects purple and violet Tailwind classes', () => {
    const fixture = `
      export function Banner() {
        return <div className="bg-purple-600 text-violet-100 border-indigo-500">Hello</div>;
      }
    `;
    const violations = lintSource(fixture, 'Banner.jsx');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.rule === 1 && v.message.includes('Purple'))).toBe(true);
  });

  it('detects decorative gradients', () => {
    const fixture = `
      const background = "bg-gradient-to-r from-red-500 to-yellow-500";
      const style = { backgroundImage: "linear-gradient(to right, red, blue)" };
    `;
    const violations = lintSource(fixture, 'styles.js');
    expect(violations.length).toBe(2);
    expect(violations[0].rule).toBe(1);
  });

  it('detects pill-shaped rounded-full on interactive buttons and inputs', () => {
    const fixture = `
      <button className="px-6 py-2.5 rounded-full bg-primary text-white">Click me</button>
      <input className="w-full py-2 px-4 rounded-full border" />
    `;
    const violations = lintSource(fixture, 'Form.jsx');
    expect(violations.length).toBe(2);
    expect(violations[0].rule).toBe(2);
  });

  it('permits circular avatars and small dot indicators', () => {
    const fixture = `
      <div data-avatar className="w-10 h-10 rounded-full overflow-hidden" />
      <span data-indicator className="w-2 h-2 rounded-full bg-primary" />
    `;
    const violations = lintSource(fixture, 'Avatar.jsx');
    expect(violations.length).toBe(0);
  });

  it('detects banned marketing filler words (elevate, seamless, unlock, journey, sanctuary)', () => {
    const fixture = `
      <h1>Elevate your daily journey in a peaceful sanctuary</h1>
      <p>A seamless curated experience that will unlock productivity</p>
    `;
    const violations = lintSource(fixture, 'Hero.jsx');
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations.every((v) => v.rule === 4)).toBe(true);
  });

  it('detects em dash character U+2014 outside comments', () => {
    const fixture = `
      <title>Nexora — Workspace Booking</title>
      <p>Quiet rooms — available now</p>
      // This is a comment with — which is allowed
    `;
    const violations = lintSource(fixture, 'Header.jsx');
    expect(violations.length).toBe(2);
    expect(violations[0].rule).toBe(5);
  });

  it('detects emojis in strings', () => {
    const fixture = `
      <span>Rated 5 stars ★</span>
      <p>Welcome home 🏠✨</p>
    `;
    const violations = lintSource(fixture, 'Rating.jsx');
    expect(violations.length).toBe(2);
    expect(violations[0].rule).toBe(5);
  });

  it('detects backdrop-filter and blur', () => {
    const fixture = `
      <div className="backdrop-blur-md bg-card/60">Glass card</div>
    `;
    const violations = lintSource(fixture, 'Card.jsx');
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toBe(10);
  });

  it('detects rotating monogram text ring and hand-drawn underline', () => {
    const fixture = `
      <div className="animate-spin-slow">text-ring monogram</div>
      <span className="wavy-underline">Hand-drawn effect</span>
    `;
    const violations = lintSource(fixture, 'Logo.jsx');
    expect(violations.length).toBe(2);
    expect(violations[0].rule).toBe(8);
  });

  it('detects useScroll outside scrollMotion.js and components importing it', () => {
    const fixture = `
      import { useScroll } from 'framer-motion';
      const { scrollY } = useScroll();
    `;
    const violations = lintSource(fixture, 'UnapprovedComponent.jsx');
    expect(violations.length).toBe(2);
    expect(violations[0].rule).toBe(6);
  });

  it('detects bento-style col-span-N and row-span-N', () => {
    const fixture = `
      <div className="grid grid-cols-4">
        <div className="col-span-2 row-span-2">Large featured card</div>
        <div className="col-span-1">Standard card</div>
      </div>
    `;
    const violations = lintSource(fixture, 'Gallery.jsx');
    expect(violations.length).toBe(2);
    expect(violations.every((v) => v.rule === 11)).toBe(true);
  });

  it('detects bento grid-flow-dense, auto-rows, and masonry/columns', () => {
    const fixture = `
      <div className="grid grid-flow-dense auto-rows-fr">Dense grid</div>
      <div className="columns-3 masonry">Masonry tiles</div>
    `;
    const violations = lintSource(fixture, 'Mosaic.jsx');
    expect(violations.length).toBe(3);
    expect(violations.every((v) => v.rule === 11)).toBe(true);
  });

  it('allows col-span-full, col-span-1, and allowlisted layout files', () => {
    const standardFixture = `
      <div className="col-span-full">Full width banner</div>
      <div className="col-span-1">Single column</div>
    `;
    expect(lintSource(standardFixture, 'UniformGrid.jsx').length).toBe(0);

    const allowlistedFixture = `
      <aside className="md:col-span-1">Sidebar</aside>
      <main className="md:col-span-3">Content</main>
    `;
    expect(lintSource(allowlistedFixture, 'ExplorePage.jsx').length).toBe(0);
  });

  it('detects extended banned words (curated, handcrafted, artisan, crafted, serene, bespoke)', () => {
    const fixture = `
      <p>Handcrafted by a local artisan with serene aesthetics</p>
      <span>Bespoke curated collection</span>
    `;
    const violations = lintSource(fixture, 'Copy.jsx');
    expect(violations.length).toBe(2);
    expect(violations.every((v) => v.rule === 4)).toBe(true);
  });

  it('passes cleanly on compliant native-feel code', () => {
    const fixture = `
      import { defaultSpring } from '../lib/motion';
      export function RoomCard({ space }) {
        return (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-editorial text-xl text-ink font-light">Quiet studio</h3>
            <p className="text-body text-sm mt-1">Room in Jaipur, Rajasthan</p>
            <button className="rounded-xl px-4 py-2 bg-primary text-white text-sm font-medium">
              View details
            </button>
          </div>
        );
      }
    `;
    const violations = lintSource(fixture, 'RoomCard.jsx');
    expect(violations.length).toBe(0);
  });
});
