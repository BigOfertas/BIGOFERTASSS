# Continuous Carousel Implementation for Superior Banner

Transform the static superior promotional banner into a professional continuous horizontal carousel with smooth, infinite movement.

## User Review Required

> [!IMPORTANT]
> - **Behavior**: Automatic, continuous, and infinite horizontal sliding (right to left).
> - **Visual Style**: Seamless loop without jumps or empty spaces (achieved via sequence duplication).
> - **Dimensions**: Strictly preserves current desktop and mobile heights/proportions defined in previous steps.
> - **Interactions**: Automatic motion; no navigation arrows or dots will be added at this stage.

## Proposed Changes

### Styling & Animations

#### src/styles.css
- Add a custom CSS keyframe animation for the continuous scroll effect.
- Define a `marquee` utility class for linear, infinite translation.

### Components

#### src/components/layout/PromoBanner.tsx
- Refactor to support multiple images (`images` array prop).
- Implement the "Marquee" structure: a container that duplicates the image set to ensure a seamless infinite loop.
- Maintain existing `aspectRatio` and `className` logic for responsive sizing.

### Routes

#### src/routes/index.tsx
- Update the "superior" banner instance to pass an array of banner images.
- Keep the current order: Superior Banner -> Header -> Inferior Banner.

## Technical Details
- **CSS Animation**: Use `translateX` from 0% to -50% (since we duplicate the content) with `linear` timing.
- **Accessibility**: Wrap the animation in a `@media (prefers-reduced-motion: no-preference)` query to respect user settings.
- **Loop Logic**: Duplicate the image array once in the DOM (`[A, B, C, A, B, C]`). When the first set finishes, it snaps back instantly to the start, which is visually identical.
