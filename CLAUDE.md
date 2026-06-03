# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
You are a lightweight coding agent built to keep software work lean and resourceful with a small core setup.

## Project Overview

**Partecipazione** is an interactive digital wedding invitation for Nicolas Gentilucci and Giulia Cro, themed around Harry Potter. The app features an animated envelope that opens to reveal the invitation details, integrated with WhatsApp RSVP functionality and a gift registry with IBAN copy feature.

- **Live**: https://nicogenti.github.io/Partecipazione/
- **Deployment**: Auto-deploys to GitHub Pages when code is pushed to the `staging` branch

## Tech Stack

- **React 19** + **TypeScript** - UI framework with type safety
- **Vite 6** - Build tool and dev server
- **TailwindCSS 4** - Styling via utility classes
- **Motion** - Animation library (Framer Motion alternative)
- **Lucide React** - Icon library

## Writing Improvement
For each user message, agents MUST first review, correct, and simplify only the user's input text before proceeding:
1.  Review grammar, spelling, punctuation, clarity, ambiguity, vagueness, and unnecessary complexity.
2.  Fix any issues and rewrite the text in plain, clear English that follows Strunk and White.
3.  Use RFC 2119 keywords: MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY.
4.  ALWAYS preserve the user's original intent when rewriting.
5.  Print the corrected version at the start of your response in a blockquote.
---
## davranışsal kurallar
-   **Think before acting.** State assumptions. Ask if the task is ambiguous.
-   **Simplicity first.** Write the minimum code. Do not add speculative flexibility.
-   **Surgical changes.** Touch only what the request requires. Match local style.
-   **Goal-driven execution.** Turn vague tasks into verifiable goals. Verify each step before moving on. Do not accumulate unverified changes.
-   **Reject scope creep.** Handle it in a separate task. If a blocker appears, stop and replan.
---

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server (runs on http://localhost:3000)
npm run dev

# Type checking (equivalent to tsc --noEmit)
npm run lint

# Production build
npm run build

# Preview production build locally
npm run preview

# Clean build artifacts
npm run clean
```

## Project Structure

```
src/
  App.tsx       - Main component: all UI logic, state, animations, and interactivity
  main.tsx      - Entry point, mounts App to DOM
  index.css     - Global styles, Tailwind import, custom CSS classes, font imports
assets/
  Hogwarts_logo.jpg              - Logo used throughout the app
  harry_potter_theme.mp3         - Background music (loops, starts on envelope open)
  albus-dumbledore-sign.jpg      - Signature image displayed on invitation
  BigliettoInternoPartecipazione.jpeg - Gift registry ticket image
.github/workflows/
  deploy.yml    - CI/CD pipeline: Node 22 → npm ci → type check → build → deploy to GH Pages
```

## Deployment

The `staging` branch is watched by GitHub Actions:
- Triggers on push to `staging` or manual workflow dispatch
- Runs type checking (`npm run lint`)
- Builds the project (`npm run build`)
- Deploys `dist/` to GitHub Pages

**Important**: Vite is configured with `base: '/Partecipazione/'` to serve from the GitHub Pages subdirectory.

## Architecture & Key Implementation Details

### Single-Component Design
All UI and logic lives in `App.tsx` (one stateful component). This is intentional for a focused, self-contained wedding invitation.

### Animation Pipeline
**Stage-based animation system** (stages 0–4):
- **Stage 0**: Envelope closed, click to open
- **Stage 1**: Wax seal (✨) scales and fades
- **Stage 2**: Top flap rotates open
- **Stage 3**: Letter slides out
- **Stage 4**: Full invitation revealed

Stages are triggered with timed `setTimeout` calls in `handleOpen()`. The top flap uses `rotateX` transformation; the letter uses `y` translation.

### Key State
- `stage` - Current animation stage (0–4)
- `isAudioMuted` / `hasStartedSong` - Audio control (theme song loops at 0.4 volume)
- `showTicket` - Modal toggle for gift registry ticket
- `copiedIban` - Temporary feedback state (resets after 2s)

### Styling System

**Custom Colors** (via Tailwind arbitrary values):
- `#fdfaf1` - Parchment/cream (paper, envelope)
- `#1a4a2e` - Dark green (text, buttons, Slytherin theme)
- `#8b1a1a` - Dark red (wax seal, Gryffindor button)
- `#d4af37` - Gold (accents, borders, icons)
- `#0c0d12` - Dark background

**Custom Fonts** (imported from Google Fonts in `index.css`):
- `Cinzel` - Formal serif (headings, buttons, labels)
- `Great Vibes` - Script/cursive (names in invitation)
- `Playfair Display` - Elegant serif (body text)

**Custom CSS Classes**:
- `.paper-surface` - Cream background with subtle noise texture and shadow
- `.envelope-surface` - Envelope styling (same texture)
- `.wax-seal` - Seal styling (dark red with inset shadow)

### Envelope Rendering
Built with absolute-positioned divs and CSS `clipPath`:
- Outer envelope (base) with flaps (left, right, bottom)
- Top flap rotates on 3D perspective (`perspective-[1200px]`, `rotateX`)
- Inner letter slides up (`y` translation)
- Wax seal scales up and fades during stage 1

All flaps use `pointer-events-none` to avoid interfering with click handlers.

### Interactive Elements
1. **Click envelope** → Triggers `handleOpen()`, plays audio, advances stages
2. **Mute button** → Only appears after song starts (stage > 0); toggles `audioRef.current.muted`
3. **"Partecipa Alla Magia" button** → Opens gift registry ticket modal
4. **"Invia il Gufo" button** → Links to WhatsApp with pre-filled message
5. **Copy IBAN button** → Copies IBAN to clipboard, shows "Copiato" feedback
6. **Back arrow** → Resets stage to 0

### Audio Implementation
- Audio element muted by default (`isAudioMuted: true`)
- Plays on first envelope click (with fallback error handling for browser autoplay policies)
- Loops continuously via `loop` attribute
- Volume set to 0.4 to avoid being intrusive

### Responsive Design
Uses Tailwind breakpoints (`sm:`, `md:`, `lg:`):
- Small screens: Envelope 340×240px, smaller fonts, stacked buttons
- Medium+: Envelope 480×320px, centered ticket modal, flex-row buttons

### GH Pages Subdirectory Handling
Vite config sets `base: '/Partecipazione/'` so built assets load correctly under github.com/nicogenti/Partecipazione/.

## Common Development Tasks

**Add a new animation state:**
- Increment the `stage` enum and add a new `setTimeout` trigger in `handleOpen()`
- Add corresponding `animate={{ condition }}` to Motion components

**Change colors:**
- Update color hex values in App.tsx (arbitrary Tailwind values) and index.css (CSS classes)
- Keep the color palette in sync (note the green/red Hogwarts house scheme)

**Modify the invitation text:**
- Edit the content inside the stage === 4 div in App.tsx
- Keep font classes aligned (Cinzel for headings, body for paragraphs)

**Update fonts:**
- Add new Google Fonts URL to `index.css` `@import`
- Add to `@theme` block with a custom property name
- Reference in Tailwind classes (e.g., `font-cinzel`)

**Test on mobile:**
- Use responsive breakpoints to verify layout on sm/md/lg screens
- Check that the envelope scales appropriately and touch targets are tappable

## TypeScript Configuration

- Target: ES2022, module ESNext
- Path alias: `@/*` maps to the root of the repo (allows `import from '@/assets/...'`)
- JSX: react-jsx (automatic runtime, no React import needed)
- Type checking enabled, no emit (via `noEmit: true`)

## Notes for Future Changes

- **Avoid adding heavy libraries** — this is a self-contained, single-page invitation. Keep dependencies minimal.
- **Test on actual devices** — animations and audio behave differently on mobile (autoplay policies, performance).
- **Validate WhatsApp links** — the phone number in the link must match the invitation text for consistency.
- **Asset sizes** — optimize images (logo, ticket) since they're embedded; music file is referenced directly.
- **Color accessibility** — the current palette is themed but ensure text contrast remains WCAG AA compliant.
