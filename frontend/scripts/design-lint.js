/**
 * Nexora Design Linter
 * Enforces Phase P1 & P2 Hard Bans across the frontend codebase:
 * - Rule 1: No purple/violet and no gradients
 * - Rule 2: No pill-shaped buttons (rounded-full on interactive elements)
 * - Rule 4: No marketing filler words (curated, handcrafted, sanctuary, artisan, crafted, serene, bespoke, elevate, etc.)
 * - Rule 5: No em dashes (—) and no emojis in user-visible copy
 * - Rule 6: No unapproved scroll listeners
 * - Rule 7: No mousemove cursor effects
 * - Rule 8: No rotating monogram text rings or decorative underlines
 * - Rule 10: No blur / backdrop-filter glassmorphism
 * - Rule 11: No bento layouts (col-span-N, row-span-N, grid-flow-dense, auto-rows, masonry/columns)
 *
 * Can be run via CLI (`npm run design:lint`) or imported for testing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Explicit gradient allowlist (None permitted under Rule 1)
export const ALLOWLISTED_GRADIENTS = [];

// Banned marketing copy and AI-template filler words
export const BANNED_COPY_WORDS = [
  'elevate',
  'elevates',
  'elevated',
  'elevating',
  'seamless',
  'seamlessly',
  'unlock',
  'unlocks',
  'unlocked',
  'unlocking',
  'journey',
  'journeys',
  'curated',
  'curated experience',
  'handcrafted',
  'sanctuary',
  'sanctuaries',
  'trusted by',
  'testimonial',
  'testimonials',
  'artisan',
  'artisans',
  'artisanal',
  'crafted',
  'craftsmanship',
  'serene',
  'bespoke',
  'heritage luxury',
  'heritage experience',
  'rich heritage',
  'our heritage',
  'heritage brand',
];

const BANNED_WORDS_REGEX = new RegExp(
  `\\b(${BANNED_COPY_WORDS.join('|')})\\b`,
  'i'
);

// Purple / Violet Tailwind classes and hex color patterns
const PURPLE_CLASSES_REGEX = /\b(text|bg|border|ring|fill|stroke|from|to|via)-(purple|violet|indigo|fuchsia)(-[0-9]+)?\b/i;
const _PURPLE_HEX_REGEX = /#(?:[789a-fA-F][0-9a-fA-F][cC-fC-F]|[4-8][0-9a-fA-F][89a-fA-F]{2,4})/i;

// Gradients
const GRADIENT_REGEX = /\b(bg-gradient-|linear-gradient|radial-gradient|conic-gradient)\b/i;

// Backdrop filter and blur
const BLUR_REGEX = /\b(backdrop-blur|backdrop-filter)\b/i;

// Em dash character (\u2014)
const EMDASH_REGEX = /\u2014/;

// Unicode Emoji regex (including common symbols like stars used as emoji)
const EMOJI_REGEX = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|[\u2600-\u26ff]|[\ud83c\udc00-\ud83d\ude4f]|[\ud83d\ude80-\ud83d\udeff]|[\ud83e\udd00-\ud83e\udfff]|★|☆)/u;

// Mousemove cursor-following
const MOUSEMOVE_EFFECT_REGEX = /\b(onMouseMove|mousemove)\b.*\b(cursor|clientX|clientY|translate)\b/i;

// Scroll listeners / useScroll
const SCROLL_LISTENER_REGEX = /\b(useScroll|addEventListener\(['"]scroll['"])\b/;

// Bento layout bans (Rule 11)
// Disallow col-span-N (except col-span-1 and col-span-full) and row-span-N
const BENTO_COL_SPAN_REGEX = /\bcol-span-(?!full\b|1\b)[0-9]+\b/i;
const BENTO_ROW_SPAN_REGEX = /\brow-span-(?!1\b)[0-9]+\b/i;
const BENTO_GRID_FLOW_DENSE = /\bgrid-flow-dense\b/i;
const BENTO_AUTO_ROWS = /\bauto-rows-\w+\b/i;
const BENTO_MASONRY = /\b(masonry|columns-[0-9]+)\b/i;

// Allowlist for standard asymmetric sidebar page splits and form layouts:
// - SpaceDetailPage (7/5 12-col split for content/booking sidebar)
// - ExplorePage (1/3 4-col split for filter sidebar/results)
// - BookingDetailPage (2-col main/sidebar)
// - ProfilePage (form fields spanning columns)
export const BENTO_ALLOWLIST_FILES = [
  'ExplorePage.jsx',
  'SpaceDetailPage.jsx',
  'BookingDetailPage.jsx',
  'ProfilePage.jsx',
];

/**
 * Remove JS/CSS comments from a line for checking string contents
 */
function stripComments(line) {
  // Remove single line // comments
  const singleIdx = line.indexOf('//');
  if (singleIdx !== -1) {
    line = line.substring(0, singleIdx);
  }
  // Remove /* ... */ comments
  return line.replace(/\/\*.*?\*\//g, '');
}

/**
 * Lint source content string for hard ban violations.
 * Returns array of { line, rule, message, snippet }.
 */
export function lintSource(content, filename = 'inline') {
  const violations = [];
  const lines = content.split('\n');

  const isScrollMotionFile = filename.includes('scrollMotion.js') || filename.includes('scrollMotion.jsx') || filename.includes('useSentinel.js');
  const isTestFile = filename.includes('src/test/') || filename.includes('src/test\\');
  const importsScrollMotion = content.includes('scrollMotion');

  const baseFilename = path.basename(filename);
  const isBentoAllowlistedFile = BENTO_ALLOWLIST_FILES.includes(baseFilename);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    const stripped = stripComments(rawLine).trim();

    // Skip empty lines
    if (!stripped) continue;

    // Check if line has explicit allow comment
    const isAllowBento = rawLine.includes('allow-bento');

    // 1. Purple / Violet colors & classes (Rule 1)
    if (PURPLE_CLASSES_REGEX.test(stripped)) {
      violations.push({
        line: lineNum,
        rule: 1,
        message: 'Purple/violet/indigo/fuchsia Tailwind class found',
        snippet: stripped,
      });
    }

    // 2. Gradients (Rule 1)
    if (GRADIENT_REGEX.test(stripped)) {
      const match = stripped.match(GRADIENT_REGEX)[0];
      const isAllowlisted = ALLOWLISTED_GRADIENTS.includes(match);
      if (!isAllowlisted) {
        violations.push({
          line: lineNum,
          rule: 1,
          message: `Gradient found: ${match}`,
          snippet: stripped,
        });
      }
    }

    // 3. Pill-shaped buttons (Rule 2)
    // rounded-full on button, a, Link, input, select, chip, tab, or interactive elements
    if (stripped.includes('rounded-full')) {
      const isAvatar = filename.includes('Avatar') || stripped.includes('data-avatar') || stripped.includes('avatar');
      const isDotIndicator = stripped.includes('data-indicator') ||
        /\bw-[1234]\.?[0-9]?\s+h-[1234]\.?[0-9]?\b/.test(stripped) ||
        stripped.includes('w-2 h-2') ||
        stripped.includes('w-1.5 h-1.5') ||
        stripped.includes('w-2.5 h-2.5') ||
        stripped.includes('w-3 h-3');

      if (!isAvatar && !isDotIndicator) {
        // If it's on an interactive element (button, link, input, tab, chip, switch)
        const isInteractive = /\b(button|link|nav|tab|chip|select|input|switch|cursor-pointer|role=["'](button|tab|switch)["']|px-|py-)\b/i.test(stripped);
        if (isInteractive) {
          violations.push({
            line: lineNum,
            rule: 2,
            message: 'Pill-shaped rounded-full found on interactive element (use 12px or 10px rounded-xl/rounded-lg)',
            snippet: stripped,
          });
        }
      }
    }

    // 4. Banned marketing / AI filler words (Rule 3 & 4)
    if (BANNED_WORDS_REGEX.test(stripped)) {
      const match = stripped.match(BANNED_WORDS_REGEX)[0];
      violations.push({
        line: lineNum,
        rule: 4,
        message: `Banned filler/marketing word found: "${match}"`,
        snippet: stripped,
      });
    }

    // 5. Em dash character (Rule 5)
    if (EMDASH_REGEX.test(stripped)) {
      violations.push({
        line: lineNum,
        rule: 5,
        message: 'Em dash (—, U+2014) found (use comma, colon, period, or hyphen)',
        snippet: stripped,
      });
    }

    // 6. Emojis (Rule 5)
    if (EMOJI_REGEX.test(stripped)) {
      violations.push({
        line: lineNum,
        rule: 5,
        message: 'Emoji character found in user-visible content',
        snippet: stripped,
      });
    }

    // 7. Rotating logo ring & hand-drawn underline (Rule 8)
    if (/\b(textring|text-ring|animate-spin-slow|wavy-underline|hand-drawn)\b/i.test(stripped)) {
      violations.push({
        line: lineNum,
        rule: 8,
        message: 'Rotating text ring or hand-drawn decorative underline found',
        snippet: stripped,
      });
    }

    // 8. Glass & Blur (Rule 10)
    if (BLUR_REGEX.test(stripped)) {
      violations.push({
        line: lineNum,
        rule: 10,
        message: 'Backdrop blur / glassmorphism effect found',
        snippet: stripped,
      });
    }

    // 9. Mousemove cursor effects (Rule 7)
    if (MOUSEMOVE_EFFECT_REGEX.test(stripped)) {
      violations.push({
        line: lineNum,
        rule: 7,
        message: 'Cursor-following or mousemove-driven transform found',
        snippet: stripped,
      });
    }

    // 10. useScroll / IntersectionObserver outside scrollMotion.js (Rule 6)
    if (SCROLL_LISTENER_REGEX.test(stripped) && !isScrollMotionFile && !importsScrollMotion) {
      violations.push({
        line: lineNum,
        rule: 6,
        message: 'useScroll or scroll event listener found outside src/lib/scrollMotion.js and components importing it',
        snippet: stripped,
      });
    }

    if (stripped.includes('IntersectionObserver') && !isScrollMotionFile && !isTestFile) {
      violations.push({
        line: lineNum,
        rule: 6,
        message: 'IntersectionObserver found outside src/lib/scrollMotion.js or sentinel hook',
        snippet: stripped,
      });
    }

    // 11. Bento layout bans (Rule 11)
    if (!isBentoAllowlistedFile && !isAllowBento) {
      // Check col-span-N (except col-span-1 and col-span-full)
      if (BENTO_COL_SPAN_REGEX.test(stripped)) {
        const match = stripped.match(BENTO_COL_SPAN_REGEX)[0];
        violations.push({
          line: lineNum,
          rule: 11,
          message: `Bento mixed column span (${match}) found (use uniform grid without cell spanning)`,
          snippet: stripped,
        });
      }

      // Check row-span-N
      if (BENTO_ROW_SPAN_REGEX.test(stripped)) {
        const match = stripped.match(BENTO_ROW_SPAN_REGEX)[0];
        violations.push({
          line: lineNum,
          rule: 11,
          message: `Bento row span (${match}) found (use uniform rows without cell spanning)`,
          snippet: stripped,
        });
      }

      // Check grid-flow-dense
      if (BENTO_GRID_FLOW_DENSE.test(stripped)) {
        violations.push({
          line: lineNum,
          rule: 11,
          message: 'Bento grid-flow-dense found (use standard grid flow)',
          snippet: stripped,
        });
      }

      // Check auto-rows
      if (BENTO_AUTO_ROWS.test(stripped)) {
        violations.push({
          line: lineNum,
          rule: 11,
          message: 'Bento auto-rows-* found (use fixed or uniform row heights)',
          snippet: stripped,
        });
      }

      // Check masonry / columns-*
      if (BENTO_MASONRY.test(stripped)) {
        violations.push({
          line: lineNum,
          rule: 11,
          message: 'Bento masonry / columns-* layout found (use uniform grid)',
          snippet: stripped,
        });
      }
    }
  }

  return violations;
}

/**
 * Scan directory recursively
 */
function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== 'dist' && item !== '.git') {
        scanDirectory(fullPath, fileList);
      }
    } else if (/\.(jsx?|css|html)$/.test(item)) {
      // Exclude design lint's own unit test file from recursive scan
      if (!item.includes('designLint.test')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

/**
 * CLI runner
 */
export function runLint() {
  const rootDir = process.cwd();
  const srcDir = path.resolve(rootDir, 'src');
  const indexHtml = path.resolve(rootDir, 'index.html');

  const files = scanDirectory(srcDir);
  if (fs.existsSync(indexHtml)) {
    files.push(indexHtml);
  }

  let totalViolations = 0;
  const results = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(rootDir, file);
    const violations = lintSource(content, relativePath);
    if (violations.length > 0) {
      totalViolations += violations.length;
      results.push({ file: relativePath, violations });
    }
  }

  if (totalViolations > 0) {
    console.error(`\n❌ Nexora Design Lint: Found ${totalViolations} violation(s):\n`);
    for (const { file, violations } of results) {
      for (const v of violations) {
        console.error(`  ${file}:${v.line} [Rule ${v.rule}] ${v.message}\n    ↳ ${v.snippet.slice(0, 100)}`);
      }
    }
    console.error('\nFix all design violations before proceeding.\n');
    return false;
  }

  console.log(`\n✅ Nexora Design Lint: All ${files.length} files passed with 0 violations.\n`);
  return true;
}

// When invoked directly via CLI
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  const success = runLint();
  if (!success) {
    process.exit(1);
  }
}
