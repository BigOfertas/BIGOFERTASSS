# Mobile Banner Proportions Refinement

Adjust the height of the top and bottom promotional banners exclusively for mobile devices while strictly preserving desktop dimensions and behavior.

## User Review Required

> [!IMPORTANT]
> - **Top Banner (Mobile)**: Vertical height will increase by **3x** compared to current mobile baseline.
> - **Bottom Banner (Mobile)**: Vertical height will increase by **2.3x** compared to current mobile baseline.
> - **Desktop**: Absolutely no changes to dimensions, aspect ratios, or framing.

## Proposed Changes

### Components & Routes

#### src/components/layout/PromoBanner.tsx
- Ensure styles properly support responsive aspect ratio overrides.
- Confirm `object-cover` and `object-center` usage for stable cropping.

#### src/routes/index.tsx
- **Superior Banner**:
  - Keep desktop `aspect-ratio: 1920/100`.
  - Apply mobile-specific aspect ratio for 3x height (`aspect-[1920/300]` or equivalent height classes).
- **Inferior Banner**:
  - Keep desktop `aspect-ratio: 1920/550`.
  - Apply mobile-specific aspect ratio for 2.3x height (`aspect-[1920/1265]` or equivalent height classes).

## Technical Details
- Use Tailwind responsive classes (e.g., `aspect-[1920/100] md:aspect-[1920/100]` with a mobile override).
- Verify no horizontal overflow occurs by keeping width at `w-full`.
- Ensure images remain undistorted by leveraging `object-cover`.
