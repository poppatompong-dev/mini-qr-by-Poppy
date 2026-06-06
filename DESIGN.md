---
name: MiniQR Design System
description: Premium municipal QR code generator styling rules
colors:
  primary: "#18181b"
  primary-foreground: "#f4f4f5"
  neutral-bg: "#ffffff"
  neutral-bg-dark: "#09090b"
  border: "#e4e4e7"
  border-dark: "#27272a"
  accent: "#2563eb"
  accent-hover: "#1d4ed8"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
---

# Design System: MiniQR

## 1. Overview

**Creative North Star: "The Responsive Utility Hub"**

MiniQR provides citizens and officers of Nakhon Sawan Municipality with a lightning-fast, highly customisable, and visual tool for creating QR codes and sharing zipped packages. The layout focuses on maximum utility, minimizing hidden options, and providing elegant tactile feedback. 

It rejects bloated, nested cards and generic low-contrast text interfaces in favor of highly readable, premium glassmorphism, responsive drawer components, and clean grid alignment.

**Key Characteristics:**
- Responsive layout with a sticky preview on desktop and a bottom-sheet drawer on mobile.
- High accessibility with dark/light mode and high-contrast color schemes.
- Micro-interactions for hovering and state changes.

## 2. Colors

The color palette utilizes a clean grayscale base with a rich blue accent for interactive elements.

### Primary
- **Zinc Dark** (#18181b / oklch(17.7% 0.005 254)): Core text and dark surfaces.
- **Zinc Light** (#f4f4f5 / oklch(96.3% 0.002 248)): Body background for clean, light contrast.

### Accent
- **Municipal Blue** (#2563eb / oklch(51.2% 0.222 263.4)): Used selectively for links, highlights, and primary actions.

### Neutral
- **Border Zinc** (#e4e4e7 / oklch(91.7% 0.005 254)): Default divider and input borders.

### Named Rules
**The 10% Accent Rule.** Use Municipal Blue accent on no more than 10% of any given screen space to highlight primary call-to-actions and active states.

## 3. Typography

**Display Font:** Inter (with system fallbacks)  
**Body Font:** Inter (with system fallbacks)

### Hierarchy
- **Display** (600, clamp(1.75rem, 4vw, 2.5rem), 1.25): App title and core page headers.
- **Headline** (600, 1.25rem, 1.35): Section headers.
- **Body** (400, 1rem, 1.5): Standard paragraphs, descriptions, and labels.
- **Label** (500, 0.875rem, 1.25): Input field headers and helper text.

## 4. Elevation

The system is flat by default with subtle glassmorphic textures for overlays and cards.

### Named Rules
**The Dynamic elevation Rule.** Borders and shadows should only change size or opacity in response to user states (hover, focus, dragging).

## 5. Components

### Buttons
- **Shape:** rounded-md (8px radius)
- **Primary:** Municipal Blue bg with zinc text.
- **Hover:** Translate -1px vertically with shadow transition.

### Inputs / Fields
- **Style:** zinc border (1px), subtle background, rounded-lg.
- **Focus:** 2px solid ring or outline offset to prevent layout shifts.

### Cards
- **Glass Card:** backdrop-filter: blur(12px), background: white/70% (or dark-zinc/75% on dark mode) with a thin zinc border.

## 6. Do's and Don'ts

### Do:
- **Do** make key user actions (like file attachments or batch switching) immediately visible on the home dashboard.
- **Do** use clear, high-contrast Thai wording for all labels, placeholders, and error messages.
- **Do** provide instant upload status updates (e.g. progress bar / zipping indicators) when file uploads are in progress.

### Don't:
- **Don't** hide critical features (like file attachment) in multi-layer modals or templates where users cannot find them.
- **Don't** use low-contrast text that fails WCAG AA guidelines.
- **Don't** use generic red alert boxes without details; explain why the action failed and how to resolve it.
