---
title: ETAPA 10 - Mobile UX Refinements & Global Animations
description: Implement mobile-specific enhancements for carousels, layout hierarchy for ShopByLeague, and smooth transitions for tabs/filters.
---

# Plan - ETAPA 10

## 1. Brazilian Teams (Mobile Enhancements)
- [ ] Increase container height to 140px on mobile.
- [ ] Update team shields size to 110px x 110px on mobile.
- [ ] Set gap to 12px between shields.
- [ ] Add `scroll-snap-type: x mandatory` and `scroll-snap-align: center`.
- [ ] Enable `scroll-behavior: smooth`.
- [ ] Implement visual indicators (5 dots/pips) below the shields (light gray, active in #dc2626).
- [ ] Add height adjustments for tablet (160px) and desktop (180px).

## 2. Visual Categories (Mobile Enhancements)
- [ ] Transform into an infinite carousel on mobile.
- [ ] Set container height to 160px on mobile.
- [ ] Set card size to 140px x 140px on mobile.
- [ ] Set gap to 12px.
- [ ] Add scroll snap.
- [ ] Implement a prominent 20px height horizontal bar below cards with a red-to-orange gradient (#dc2626 to #f97316).
- [ ] Ensure the bar follows scroll position (parallax effect).
- [ ] Implement seamless infinite loop.
- [ ] Add height adjustments for tablet (180px) and desktop (200px).

## 3. Shop By League (Layout & Transitions)
- [ ] Reorganize mobile layout: 2 lines (3 abas + 2 abas) using `flex-wrap` and `justify-center`.
- [ ] Increase tab font size to 16px and padding to 8px 16px on mobile.
- [ ] Implement 300ms crossfade transition (150ms fade out -> change data -> 150ms fade in) for products when switching leagues.
- [ ] Style active tab with 3px red underline and black text.

## 4. Best Sellers (Refinements)
- [ ] Remove red color from "MENTOS" in "LANÇAMENTOS" title (ensure it's 100% black).
- [ ] Implement the same 300ms crossfade transition for tab switching (Mais Vendidos / Lançamentos).

## Technical Details
- Use Tailwind CSS v4 for all styling.
- Use `useState` for tracking active tabs and scroll positions for animations.
- Implement CSS transitions for opacity fades.
- Ensure no external libraries are added.
- Maintain existing logic and mock data.
