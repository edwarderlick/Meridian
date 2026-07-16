---
name: Meridian Console
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#dabfd3'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#a2899c'
  outline-variant: '#554151'
  surface-tint: '#ffaaf6'
  primary: '#ffaaf6'
  on-primary: '#5b005d'
  primary-container: '#f432f6'
  on-primary-container: '#4f0051'
  inverse-primary: '#a800ab'
  secondary: '#d1bcff'
  on-secondary: '#3c0090'
  secondary-container: '#7000ff'
  on-secondary-container: '#ddcdff'
  tertiary: '#4cd6ff'
  on-tertiary: '#003543'
  tertiary-container: '#009dc1'
  on-tertiary-container: '#002e3a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffd7f6'
  primary-fixed-dim: '#ffaaf6'
  on-primary-fixed: '#380039'
  on-primary-fixed-variant: '#800083'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d1bcff'
  on-secondary-fixed: '#23005b'
  on-secondary-fixed-variant: '#5700c9'
  tertiary-fixed: '#b7eaff'
  tertiary-fixed-dim: '#4cd6ff'
  on-tertiary-fixed: '#001f28'
  on-tertiary-fixed-variant: '#004e60'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system embodies a premium, high-fidelity atmosphere tailored for institutional-grade treasury management. It centers on a **Glassmorphic** aesthetic, utilizing deep obsidian layers to create a sense of infinite digital space. The brand personality is precise, avant-garde, and secure, evoking the feeling of a futuristic flight deck for multi-chain liquidity.

The visual mood is established through semi-transparent surfaces, ultra-refined "inner-glow" gradient strokes, and vibrant spectral accents that signify activity and value flow. High-contrast functional elements ensure that while the environment is immersive, the data remains clinical and actionable.

## Colors
The palette is rooted in a "Deep Obsidian" foundation to provide maximum contrast for neon-inflected accents.
- **Primary (Vibrant Pink):** Used for primary calls to action and critical "Live" treasury status.
- **Secondary (Deep Purple):** Represents multi-chain connectivity and secondary interactive states.
- **Tertiary (Electric Blue):** Dedicated to USDC-specific data points and stablecoin liquidity indicators.
- **Surface & Background:** The background is near-black obsidian. UI surfaces utilize a semi-transparent glass fill with a 20px - 40px backdrop blur to maintain legibility over ambient background glows.

## Typography
Typography is split into three functional tiers. **Hanken Grotesk** is used for impactful headlines and balances, providing a modern, sharp edge. **Inter** handles all standard UI text, ensuring high legibility in complex density environments. **JetBrains Mono** is strictly reserved for technical data, wallet addresses, and transaction hashes to maintain a "developer-refined" treasury feel.

Maintain tight tracking on headlines and generous line-height on body text to preserve the premium editorial feel inspired by the reference imagery.

## Layout & Spacing
This design system utilizes a **fluid 12-column grid** with wide margins to create a spacious, center-aligned aesthetic. 
- **Desktop:** 48px outer margins with 24px gutters. Content is often contained within glass cards that span 4, 6, or 12 columns.
- **Tablet:** 32px margins, transitioning to an 8-column layout.
- **Mobile:** 16px margins with a single-column stack.

Rhythm is maintained through an 8px base unit. Component internal padding should be generous (24px - 32px for cards) to allow the glassmorphic background blurs to "breathe."

## Elevation & Depth
Depth is conveyed through **back-lit layering** rather than traditional drop shadows.
- **Level 0 (Base):** Deep obsidian background with subtle, large-scale radial blurs in primary/secondary colors (opacity 10-15%).
- **Level 1 (Cards):** Semi-transparent fills (3-5% white) with a 1px inner-glow gradient stroke. These cards appear to float above the background glows.
- **Level 2 (Overlays/Modals):** Darker, less transparent fills (10% white) with higher backdrop-blur values (60px) and a soft, diffused shadow tinted with the secondary purple color.
- **Interactive States:** On hover, cards should increase stroke opacity and glow intensity.

## Shapes
The shape language is sophisticated and heavily rounded to soften the technical nature of the product.
- **Main Containers/Cards:** 24px (`rounded-2xl`) to create a distinct, modular container feel.
- **Primary Controls/Buttons:** 12px (`rounded-xl`) for a modern, tactile interaction point.
- **Identity Elements:** Token logos, chain icons, and user avatars are strictly circular (discs) to contrast against the geometric grid.

## Components
- **Buttons:** Primary buttons use a solid-to-vibrant gradient fill. Secondary buttons use the Glassmorphic style with a high-contrast white border.
- **Chips:** Small, pill-shaped indicators with technical data in JetBrains Mono. Use subtle background tints (e.g., 10% opacity Tertiary Blue) for USDC-related labels.
- **Lists:** Transaction lists should be borderless, separated by thin 1px lines (rgba 255, 255, 255, 0.05).
- **Cards:** The core of the UI. Every card must have a `backdrop-filter: blur(20px)` and a gradient border that is slightly brighter at the top-left corner to simulate a light source.
- **Motion:** All interactions follow a 200ms "Ease-Out-Cubic" curve. Use staggered entrances (30ms delay per item) for list views. Pulsing states are used sparingly for "Syncing" or "Live" blockchain events.
- **Treasury Gauges:** Circular progress rings using the primary-to-secondary gradient to visualize asset distribution.