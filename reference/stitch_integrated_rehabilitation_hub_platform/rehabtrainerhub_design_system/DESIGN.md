---
name: RehabTrainerHub Design System
colors:
  surface: '#f9f9fc'
  surface-dim: '#dadadc'
  surface-bright: '#f9f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f6'
  surface-container: '#eeeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e5'
  on-surface: '#1a1c1e'
  on-surface-variant: '#3f484a'
  inverse-surface: '#2f3133'
  inverse-on-surface: '#f0f0f3'
  outline: '#6f797a'
  outline-variant: '#bfc8ca'
  surface-tint: '#1c6872'
  primary: '#004148'
  on-primary: '#ffffff'
  primary-container: '#005a64'
  on-primary-container: '#8bcfda'
  inverse-primary: '#8ed1dd'
  secondary: '#a83900'
  on-secondary: '#ffffff'
  secondary-container: '#fc6018'
  on-secondary-container: '#531800'
  tertiary: '#00450d'
  on-tertiary: '#ffffff'
  tertiary-container: '#055f17'
  on-tertiary-container: '#86d781'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a9eef9'
  primary-fixed-dim: '#8ed1dd'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#ffdbcf'
  secondary-fixed-dim: '#ffb59a'
  on-secondary-fixed: '#380d00'
  on-secondary-fixed-variant: '#802a00'
  tertiary-fixed: '#a3f69c'
  tertiary-fixed-dim: '#88d982'
  on-tertiary-fixed: '#002204'
  on-tertiary-fixed-variant: '#005312'
  background: '#f9f9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e2e2e5'
typography:
  display-lg:
    fontFamily: Public Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Public Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  instructional:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 30px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 48px
  margin-mobile: 16px
  touch-target-min: 48px
---

## Brand & Style
The design system is engineered for the medical rehabilitation space, where clarity, trust, and accessibility are paramount. The brand personality is **Encouraging yet Professional**, striking a balance between clinical authority and the warmth required for patient recovery journeys.

The visual style follows a **Corporate / Modern** aesthetic with a focus on high-legibility and functional simplicity. It prioritizes information density for practitioners while ensuring a stress-free, high-contrast experience for patients who may be experiencing cognitive or physical fatigue. Every design decision is filtered through the lens of WCAG AA compliance to ensure the platform remains inclusive and empowering for all users.

## Colors
The color palette is anchored in medical reliability and high-visibility action.

- **Primary (Deep Medical Teal):** Used for headers, navigational elements, and primary branding to instill a sense of calm, professional authority.
- **Secondary (Encouraging Orange):** Reserved for primary calls-to-action (CTAs). This warm hue provides a high-contrast focal point that guides the user toward progress-oriented tasks.
- **Tertiary (Forest Green):** Used for success states, completed milestones, and health-positive indicators.
- **Neutral:** A range of high-contrast slates and grays. Text is kept at a minimum of 4.5:1 contrast ratio against backgrounds to ensure readability for users with visual impairments.

The background uses a soft, off-white (#F8FAFB) to reduce screen glare during long sessions, while critical information blocks use pure white for maximum separation.

## Typography
The typography strategy prioritizes legibility over decoration. 

- **Public Sans** is used for headlines. Its institutional and clear character provides an authoritative structure to the information hierarchy. 
- **Inter** is used for body text and UI labels. It is a systematic, utilitarian font that remains highly readable even at smaller sizes or on lower-resolution screens.

To accommodate patients who may have difficulty reading standard text sizes, the default body size is set to **18px (body-lg)** for instructional content. Line heights are intentionally generous (1.5x - 1.6x) to prevent lines of text from blurring together for users with dyslexia or visual fatigue.

## Layout & Spacing
The layout uses a **Fixed Grid** system to provide a stable, predictable interface. 

- **Desktop:** A 12-column grid with a 1280px max-width centered in the viewport.
- **Tablet:** An 8-column grid with 24px gutters.
- **Mobile:** A 4-column grid with 16px margins.

Spacing follows an 8px linear scale. A critical constraint of this design system is the **48px minimum touch target** for all interactive elements, ensuring that users with limited fine motor skills can navigate the platform without error. Generous white space is utilized between sections to prevent "visual noise" and help users focus on one task at a time.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** rather than heavy shadows, maintaining a clean and medical-grade appearance.

1.  **Base Layer:** The light-gray page background.
2.  **Surface Layer:** White cards and containers that sit directly on the base. These use a very subtle, 1px neutral stroke (#E0E4E8) instead of shadows to define boundaries clearly.
3.  **Raised Layer:** Used for active modals or floating action buttons. These utilize an **Ambient Shadow** (low-opacity, highly diffused) to indicate temporary interaction.

By avoiding complex gradients and heavy shadows, the UI remains "flat" enough to ensure that contrast ratios are never compromised by background decorations.

## Shapes
The shape language is **Rounded**, utilizing a 0.5rem (8px) base radius. This softening of corners makes the medical environment feel more approachable and less "sharp" or intimidating. 

Larger components like cards and instructional blocks use **rounded-lg (16px)** to create a friendly, container-like feel that "hugs" the content. Interactive elements like buttons do not use full pills (which can sometimes hide the clickability of the edges) but instead stick to the consistent 8px radius to maintain a professional, sturdy appearance.

## Components

### Buttons
Primary buttons use the Secondary Orange color with bold white text. They must have a minimum height of 48px. Hover states should darken the background color by 10%, while focus states must show a high-contrast 2px teal ring for keyboard navigation.

### Cards
Cards are the primary navigational vehicle. They feature a white background, a 1px border, and 24px of internal padding. For sub-system navigation (e.g., "Exercise Library"), cards should include a large, simplified icon and a clear headline.

### Instructional Blocks
Instructional blocks are highlighted with a Primary Teal left-border (4px width) and a very light teal background tint. These are used for "Tips from your Trainer" or "Safety Precautions," using the `instructional` typography token.

### Input Fields
Forms use large, clearly labeled fields. Labels must always be visible (no placeholder-only labels) to assist users with cognitive impairments. Error states must be indicated with both a red color and an "Error" icon to ensure accessibility for color-blind users.

### Progress Indicators
Progress bars use a thick 12px track. The track is light gray, and the progress fill is Tertiary Green, providing a clear, high-contrast visual of the patient's recovery journey.