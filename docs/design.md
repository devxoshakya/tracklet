# Design System — Tracklet (v3, Hikari-derived)

> A tracker UI built on a calm cool-gray canvas, a framed watercolor hero, and a single blue accent. Light and dark are first-class themes driven by shadcn semantic variables. The pixel-art system of v2 is retired; the marketing language comes from the Hikari web app blueprint.

## 1. Principles

1. **Framed calm.** The marketing hero is a bordered card floating over a blueprint "scale" frame; the app is quiet cool-gray with white (or dark-elevated) cards and 1px hairlines.
2. **One accent, one action.** Blue (`#1a5cff` light / `#3b76ff` dark) is the only interactive accent. Everything else is neutral. Never decorate with color.
3. **Theme-aware artwork.** Photography/illustration dims, desaturates, and fades into the theme's own canvas color — never pastes a light-only asset onto a dark page.
4. **3D where it matters.** Primary actions get a keycap-style bottom edge; everything else stays flat. Depth is reserved for CTA, Google button, and cards.
5. **shadcn as the component floor.** Buttons, dropdowns, toasts come from `@tracklet /ui` (shadcn / Base UI). Pages compose over them, never bypass them, except where a marketing moment needs custom layout.
6. **Accessible by default.** Text contrast ≥ 4.5:1 in *both* themes, hit targets ≥ 40px, visible focus rings, no color-only meaning.

---

## 2. Design Tokens

All tokens are shadcn semantic CSS variables. Source of truth for base mapping: `packages/ui/src/styles/globals.css`. Tracklet overrides live in `apps/web/src/index.css` and win (imported after).

### Light (`:root`)

```css
:root {
  --background: #f4f6f7;      /* page canvas, cool gray */
  --foreground: #111318;      /* primary text */

  --card: #ffffff;            /* cards, hero, popovers */
  --card-foreground: #111318;
  --popover: #ffffff;

  --primary: #1a5cff;         /* THE accent: buttons, links, kicker */
  --primary-foreground: #ffffff;

  --secondary: #e8ecef;       /* subtle fills */
  --secondary-foreground: #111318;

  --muted: #eef2f4;           /* hover rows, skeletons */
  --muted-foreground: #6b6f73;/* secondary text (AA on bg) */

  --accent: #e6f0ff;          /* selected/soft-blue fills */
  --accent-foreground: #123f9e;

  --destructive: #d93025;
  --border: #d7dadd;
  --input: #c9ced4;
  --ring: #1a5cff;
}
```

### Dark (`.dark`)

```css
.dark {
  --background: #0f1113;
  --foreground: #e7e9eb;

  --card: #15181c;            /* elevated one step */
  --card-foreground: #e7e9eb;
  --popover: #191c20;

  --primary: #3b76ff;         /* brighter for AA on dark */
  --primary-foreground: #ffffff;

  --secondary, --muted: #1b1f24 / #171b1f;
  --muted-foreground: #9aa0a6;
  --accent: #16243c;  --accent-foreground: #8fb4ff;
  --destructive: #ff5449;
  --border: rgb(255 255 255 / 9%);
  --input: rgb(255 255 255 / 14%);
  --ring: #3b76ff;
}
```

Usage rules:
- **Never hard-code gray hexes in components.** Use utilities: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-popover`, `focus-visible:ring-ring`.
- Fixed-color *content* (e.g. the Google logo, brand image) stays literal via `dark:`-variant treatments.
- Status colors (green/orange/red/violet) come later with the tracker tables; follow shadcn "soft fill + text-safe shade" per theme then.

### Radius

`--radius: 10px` base. Cards/popovers/modals: 10–12px (`rounded-xl`); buttons/inputs: `rounded-lg` (8px) in marketing, shadcn defaults inside dense app UI; chips/badges: 4–6px. Nothing else.

---

## 3. Typography

| Role | Font | Notes |
|---|---|---|
| Display / headings / body | Geist Sans (`--font-geist-sans`) | default `font-sans` |
| Data, IDs, logs | Geist Mono (`--font-geist-mono`) | `tabular-nums` on all numbers |

**Headline style:** extra-bold (800), tight tracking `-0.02em…-0.075em`, near-zero leading (0.91–1.1). Hero uses `clamp(46px, 6.2vw, 84px)`; card titles `clamp(24px, 2.6vw, 34px)`.
**Kicker:** 11px, weight 700, uppercase, tracking +0.09em, color `text-primary`.

---

## 4. Layout

### Marketing frame (landing)

A 3-column × 3-row grid frames the hero card with blueprint "scale" strips (1px diagonal hairline pattern, `--border`):

```
┌ scale ──────────────────────┐
║ ┌ hero card (max 1200px) ┐ ║
║ │ logo · … · theme toggle │ ║
║ │ mountains → fade to bg  │ ║
║ │ kicker                  │ ║
║ │ H1 (clamp)              │ ║
║ │ sub · CTA               │ ║
║ └─────────────────────────┘ ║
└ scale ──────────────────────┘
```

- Strips: 10px pattern via `repeating-linear-gradient(315deg, #c9ced4 …)`; dark uses `#272c31`.
- Mobile (<700px): strips shrink to 12px gutters, hero art position shifts to `58% top`.

### App shell (signed-in)
Side nav 232px + 56px top bar (as PRD 12.2). Page padding 24px desktop / 16px mobile. Reading views cap at 720px. Breakpoints `480 / 720 / 1100 / 1440`.

---

## 5. Elevation & the 3D Button (signature)

**3D buttons** (`.btn-3d` + edge variants in `apps/web/src/index.css`):
- A solid **bottom edge** (like a keyboard keycap) plus a soft elevation shadow:
  `box-shadow: 0 3px 0 0 edge, 0 10px 20px rgba(15,17,20,.12), 0 2px 4px rgba(15,17,20,.08)`.
- Hover: lifts 1px, shadow deepens. Active: **presses down** — `translateY(3px)`, shadow collapses onto the edge (feels like a keyboard keycap).
- Variants: `.btn-3d-primary` (blue, edge `#0c3fd4` / dark `#1e4ec2`) and `.btn-3d-light` (white card button, edge `#ccd3d9` / dark `rgb(0 0 0 / 40%)`, with black/40 for dark).
- `prefers-reduced-motion`: transitions off, presses become shadow-only.
- Pair with: `bg-primary text-primary-foreground` or `bg-card border-border`; always `rounded-lg`, focus ring `focus-visible:ring-2 ring-ring/60`.

**Other elevation:**
- Cards: `bg-card border border-border rounded-xl shadow-[0_18px_45px_rgba(15,17,20,0.08)]`.
- Flat cards inside tables/boards: border only; shadow on hover/drag.
- Popovers/menus: shadcn default shadow; modals radius 10px, scrim `rgba(15,17,20,.28)` + blur.

---

## 6. Components

### 6.1 Buttons
- **Primary CTA (marketing):** `.btn-3d.btn-3d-primary`, h 48px, px 32, semibold 15px.
- **Google sign-in:** `.btn-3d.btn-3d-light`, h 48px full-width, GoogleIcon 20px + label centered optically.
- **App-internal buttons:** shadcn `Button` from `@tracklet /ui/components/button` (default/outline/ghost/destructive). To 3D-ify: add `btn-3d btn-3d-light` + size overrides (`h-11 rounded-lg px-5 text-[15px] font-semibold`).
- Loading replaces label with spinner; width locked.
- Focus: `focus-visible` ring in `--ring`; never remove outline without replacement.

### 6.2 Inputs
h 40px, `bg-card`, 1px `--input`, radius 8px. Focus: border `--ring` + ring. Labels above field, 13px weight 500. Error: `--destructive` border and helper text.

### 6.3 Status chips (tracker core)
Rectangle 4px, h 22px, 12px medium, 6px leading dot. Light: soft fill + dark text variant. **Dark: fill at 15–20% alpha of the accent color, text at the light-tint shade** — soft hex fills would look banded on `--card`. Labels always visible; never color alone.

### 6.4 Command palette, drawer, board
Per PRD; visual specs carry over from shadcn defaults: palette = 560px popover; drawer = right 440px radius-left 10px; board cards = `bg-card` radius 8px border, hover shadow, drag lifts with `--shadow-pop` equivalent + 1.2deg rotate.

### 6.5 Toasts
Sonner (`@tracklet /ui/components/sonner`, `richColors`) bottom-right. Errors always include a retry path in copy.

### 6.6 Theme toggle
A **quiet ghost icon** (shadcn `Button` ghost variant, 40×40 hit target but no border, no shadow, no background): sun in light, moon in dark. One tap flips directly between the light and dark systems. Sits in the hero card header, right-aligned; 13% opacity-on-hover tint keeps it out of the artwork's way. Chrome-free by design — the frame should never compete with the hero.

---

## 7. Login & Auth Screen

Split-screen, per the Hikari reference:

- **Left panel (≥1024px):** watercolor mountains at `bg-top`, dimmed per theme; bottom fade lands on the theme's own `--background` so panel and page knit together. Bottom-left stack: blue kicker ("Welcome back") + statement headline (max 420px, 2 lines).
- **Right panel:** centered stack ≤ 400px — brand mark 56px → "Sign in to Tracklet" → sub → Google button → legal.
- **Google-only sign-in (PRD FR-AUTH-01):** no credentials form, no GitHub. Any `?redirect=` target is sanitized (relative paths only — open-redirect guard) and shown as a reassurance line.
- **States:** signed-in users never see the page (server + client guards redirect to `/dashboard`). Server down / popup blocked → sonner error toast + button re-enabled.
- Legal: 12px `text-muted-foreground opacity-75`, underlined links.

---

## 8. Brand

- **Mark:** the rounded-triangle blob logo (`public/logo.svg`), rendered as an inline SVG (`components/brand-mark.tsx`) with `fill="currentColor"` + `text-foreground`, so it inks to the theme automatically (near-black on light canvas, light on dark canvas).
- **Wordmark:** "Tracklet" 2xl, weight 800, tracking -0.06em, beside the mark.
- **Favicons/PWA:** `src/app/favicon.ico`, `src/app/icon.svg` (glyph icon, color-scheme-aware), `public/favicon/*` (96px, apple-touch 180px), manifest icons 192/512.

---

## 9. Theming & Dark-Mode Rules

1. Strategy: `next-themes`, `attribute="class"`, `defaultTheme="system"`, `disableTransitionOnChange`; `<html suppressHydrationWarning>`. Toggle is instant (no flash — class swap before paint).
2. `themeColor` viewport per scheme: light `#f4f6f7`, dark `#0f1113`.
3. **Artwork treatment (dark):** dim (`opacity ≈ .3–.4`, `brightness ≈ .4–.5`, `saturate ≈ .45–.55`) + gradient fade *into `--background` color*, not into black. Light overlay direction inverts (dark rgba on top of art).
4. Shadows: on dark, prefer larger soft rgb(0,0,0) shadows + black/40 3D edges; never warm gray.
5. Statuses/charts: alpha fills + light-tint text (§6.3).
6. Test every screen in both themes; hard-coded grays are a bug.

---

## 10. Accessibility

* Contrast ≥ 4.5:1 for body and meta in both themes (dark `--muted-foreground: #9aa0a6` on `#0f1113` ≈ 5.5:1).
* Kickers over artwork must sit above the fade's darkest band; verify in dev, not by eye after ship.
* Focus visible always (`ring-ring/60`), hit targets ≥ 40px (44px touch).
* Brand/decorative art: `aria-hidden`; informative art gets alt text.
* `prefers-reduced-motion`: 3D press keeps the shadow change, drops transforms; page fades ≤ 120ms.

---

## 11. Motion

* Default transition 120–200ms ease on background, border, box-shadow, transform.
* Route change: 160ms fade + 4px rise.
* 3D button press (§5) is the signature interaction.
* Drag-and-drop: FLIP 200ms; drop into "Done" → checkmark fill + one-shot particle burst (450ms, respects reduced motion later with sparkline-safe equivalent).
* Skeletons on `--muted`, shimmer 1.4s, shapes match final layout.

---

## 12. Content & Voice

* Direct, warm, pragmatic. Short sentences, verbs first. Copy borrowed from Hikari's tone: one-line product promise + concrete feature list.
* Landing: kicker "Your Jira tickets and PRs, finally in one place." → "Every Jira ticket, tracked to done."
* Never say "merge verification" (PRD §19). Buttons: "Get started", "Continue with Google", "Sign out". No "Submit"/"OK".

---

## 13. Do's and Don'ts

**Do**
* Keep both themes live at all times; every token change gets a dark counterpart.
* Use shadcn semantic utilities — grep for raw hex in `src/app` and replace them.
* Reserve 3D for primary actions and the Google button.
* Integer-scale the brand mark; wrap in `rounded` only via the SVG itself.

**Don't**
* Don't put light-faded artwork on dark pages, or vice versa.
* Don't use `--primary` more than a couple of times per viewport — it's a pointer, not paint.
* Don't exceed two shadow layers + one edge; heavier reads as "disabled", especially in dark mode.
* Don't mix radii arbitrarily: 4 / 6 / 8 / 10 / 12 / pill, nothing else.
* Don't encode meaning with color alone.

---

## 14. Implementation Notes

* Tailwind v4 with `@import "tailwindcss"` + shadcn tokens (`packages/ui/src/styles/globals.css`), `tw-animate-css` for enter/exit animations.
- Theme variable overrides ship in `apps/web/src/index.css` (imported after ui globals; app-level wins).
* Fonts via `next/font/google` (Geist pair, `font-display: swap`).
* Art: PNG/WebP photography (mountains) cached by browsers; filed once per design with `bg-cover bg-top`.
* Target performance: LCP < 2s, interaction latency < 100ms, 60fps drag.
* Stack reminder: Next 16 App Router, Better Auth (Google-only), Hono auth server on a different host (`NEXT_PUBLIC_SERVER_URL`); signed-status checks degrade to anonymous instead of erroring.
