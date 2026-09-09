---
name: Fahad's Portfolio
description: Hyper-Pop Maximalist Portfolio
colors:
  primary: "#ff2a2a"
  primary-pink: "#ff007f"
  primary-green: "#39ff14"
  secondary: "#00f0ff"
  secondary-yellow: "#eaff00"
  secondary-purple: "#b200ff"
  neutral-bg: "#0a0a0a"
  neutral-surface: "#151515"
  neutral-text: "#f0f0f0"
  neutral-border: "#000000"
typography:
  display:
    fontFamily: "'Syne', sans-serif"
    fontWeight: 800
  body:
    fontFamily: "'Space Grotesk', sans-serif"
    fontWeight: 400
rounded:
  none: "0px"
spacing:
  section: "8rem 2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-border}"
    padding: "1rem 2rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.neutral-border}"
    padding: "1rem 2rem"
  card:
    backgroundColor: "{colors.neutral-border}"
    padding: "2.5rem"
---

# Design System: Fahad's Portfolio

## Overview

**Creative North Star: "Neon Brutalist Spider-Verse"**

The visual language is raw, glitchy, comic-book inspired, and undeniably fun. It completely rejects modern, minimalist "clean" design in favor of aggressive, high-contrast, hyper-pop energy. The aesthetic is built on harsh collisions of saturated neon colors against deep blacks, paired with brutalist typography and hard offset drop shadows.

**Key Characteristics:**
- Unapologetically loud and vibrant
- Strictly flat geometry with zero blur or softness
- High-contrast comic-book style layouts
- Glitch animations and kinetic typography

## Colors

The palette is driven by synthetic comic-book ink and neon hues. 

### Primary
- **Spider Red** (#ff2a2a): The core brand color, used for primary calls to action and dominant graphic elements.
- **Venom Pink** (#ff007f): Used for high-impact shadows, glitch text effects, and selection highlights.
- **Radioactive Green** (#39ff14): Secondary highlight color, primarily used in scrollbars and specific UI accents.

### Secondary
- **Electro Blue** (#00f0ff): Used for links, secondary buttons, and the opposing side of the glitch text effect.
- **Arcade Yellow** (#eaff00): Used for badges, hover states on links, and hard offset shadows.
- **Prowler Purple** (#b200ff): Deep neon accent for tertiary highlights.

### Neutral
- **Abyss Black** (#0a0a0a): The primary background color.
- **Surface Black** (#151515): Used for raised surfaces like the subtitle box to differentiate from the abyss.
- **Comic Ink** (#000000): Used for brutalist borders and text on neon backgrounds.
- **Harsh White** (#f0f0f0): Used for primary body copy and thick brutalist borders.

### Named Rules
**The Maximum Contrast Rule.** Neons must only ever touch deep blacks or pure whites. Never mix neons together in gradients; they must collide with hard edges.

## Typography

**Display Font:** 'Syne', sans-serif
**Body Font:** 'Space Grotesk', sans-serif

**Character:** The typography is aggressive and unapologetic. The display font is thick, stretched, and often animated with CSS glitch effects, while the body font provides a slightly rigid, technical, monospaced feel.

### Hierarchy
- **Display** (800, clamp(3rem, 10vw, 8rem), 0.9): Massive headers, hero titles. Usually uppercase with negative letter-spacing (-2px to -5px).
- **Body** (400, 16px, 1.6): Standard reading text.
- **Labels** (700, 0.85rem, uppercase): Used in the brutalist badges.

### Named Rules
**The Glitch Rule.** Important display text should break the fourth wall using the custom CSS glitch animation with split cyan and pink channels.

## Layout

The layout uses a standard 1400px max-width container (`.section-container`) with massive `8rem 2rem` section padding. Backgrounds utilize CSS-drawn grid patterns and fixed SVGs to create a noisy, textured environment.

## Elevation & Depth

Strictly flat with hard offset shadows (like a printed comic book panel or retro UI). There is zero blur, zero opacity scaling, and zero soft diffusion.

### Shadow Vocabulary
- **Pink Offset** (`8px 8px 0 #ff007f`): Default shadow for brutal-cards.
- **Red Offset** (`8px 8px 0 #ff2a2a`): Secondary component shadow.
- **Blue Drop** (`8px -8px 0 #00f0ff`): Used for elevated text boxes.
- **White Kick** (`4px 4px 0 #f0f0f0`): Hover shadow for primary buttons.

### Named Rules
**The Hard Offset Rule.** All shadows must be solid blocks of color with 0px blur. 

## Shapes

Everything is a hard rectangle. There are no `border-radius` curves. Borders are excessively thick (4px to 8px) to emulate inked comic panels.

## Components

Components are tactile, heavy, and unapologetically bold (like punching an arcade button).

### Buttons
- **Shape:** 0px radius, 3px solid black border.
- **Primary:** Spider Red background, Comic Ink text, 4px White shadow.
- **Hover / Focus:** Shadow tightens to 2px, button translates 2px down/right to simulate a physical button press.
- **Secondary:** Electro Blue background, Comic Ink text, 4px Red shadow.

### Cards / Containers
- **Corner Style:** 0px radius.
- **Background:** Comic Ink background with a repeating linear-gradient noise overlay.
- **Shadow Strategy:** Solid 8px neon offset shadows.
- **Border:** Thick 4px Harsh White border.
- **Internal Padding:** 2.5rem.

### Badges / Tags
- **Style:** Arcade Yellow background, Comic Ink text, 2px solid border, 2px solid offset shadow.

## Do's and Don'ts

### Do:
- **Do** use heavy, solid-color offset shadows for any elevated element.
- **Do** ensure all borders are at least 3px thick.
- **Do** keep components completely rectangular (no rounded corners).

### Don't:
- **Don't** use soft box-shadows or blurs (except for the underlying hero ambient blobs).
- **Don't** use pastel or muted colors.
- **Don't** use subtle transitions; interactions should feel instantaneous or bouncy.
