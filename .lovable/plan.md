# Mobile Banner Proportions Refinement

Adjust the height of the top and bottom promotional banners exclusively for mobile devices while strictly preserving desktop dimensions and behavior.

## User Review Required

> [!IMPORTANT]
> - **Top Banner (Mobile)**: Vertical height will increase by **3x** compared to the current mobile state.
> - **Bottom Banner (Mobile)**: Vertical height will increase by **2.3x** compared to the current mobile state.
> - **Desktop**: No changes will be made to dimensions, ratios, or framing.

## Proposed Changes

### Components & Routes

#### [src/components/layout/PromoBanner.tsx]
- Ensure the component correctly handles responsive aspect ratios or height overrides passed via `className` or `style`.
- Maintain `object-cover` and `object-center` for predictable cropping without distortion.

#### [src/routes/index.tsx]
- **Superior Banner**:
  - Maintain desktop `aspect-ratio: 1920/100`.
  - Add mobile-specific height classes to achieve the 3x increase (targeting roughly `h-[150px]` or a specific mobile aspect ratio like `320/50` -> `320/150`).
- **Inferior Banner**:
  - Maintain desktop `aspect-ratio: 1920/550`.
  - Add mobile-specific height classes to achieve the 2.3x increase (targeting roughly `h-[450px]` or a specific mobile aspect ratio).

## Technical Details
- Use Tailwind responsive prefixes (`max-md:`, `md:`) to isolate changes.
- Calculate mobile heights based on current rendered values:
  - Current Superior Mobile: ~50px (based on 1920/100 ratio on a 320px screen) -> New: ~150px.
  - Current Inferior Mobile: ~180px (based on 1920/550 ratio on a 320px screen) -> New: ~414px.
- Use `aspect-ratio` overrides for mobile:
  - Superior: `aspect-[1920/300]` (3x height ratio).
  - Inferior: `aspect-[1920/1265]` (2.3x height ratio).
