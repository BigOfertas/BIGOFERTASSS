# Plan - Frontend Phase 2 (BIGofertas)

Implement the top visual structure of the home page, including promotional slots and the main header, following the specific architectural rules and visual style requested.

## Proposed Changes

### 1. Components Creation
- Create `src/components/layout/PromoBanner.tsx`: A reusable component for PNG promotional banners. It will support independent configurations, responsive behavior with centralized mobile cropping (safe area), and will not be strictly limited to the site's max-width by default.
- Create `src/components/layout/Header.tsx`: The main e-commerce header featuring a search bar, account/cart links.
- Create `src/components/layout/CategoryNav.tsx`: Horizontal category navigation for desktop.
- Create `src/components/layout/MobileHeader.tsx`: Specific mobile layout for the header as requested.

### 2. Header Implementation
- **Visual Style**: Clean e-commerce, predominantly white background, red/white/black palette, professional finish, no generic AI aesthetics.
- **Desktop**: Logo, Search Bar (centered), User/Account, and Cart within a `max-w-7xl mx-auto` container. Below that, the category navigation.
- **Mobile**: Hamburger menu (left), Logo (center), Account/Cart (right). Below that, a full-width search bar.

### 3. Promotional Arts
- **Slot 1 (Superior)**: Above the header.
- **Slot 2 (Inferior)**: Below the header and category navigation.
- Both slots are independent and will use placeholders for now.

### 4. Home Page Update
- Modify `src/routes/index.tsx` to compose the structure: `PromoBanner` (Superior) -> `Header` -> `PromoBanner` (Inferior) -> `Neutral Space`.

## Technical Details
- **Safe Area**: The `PromoBanner` will use `object-fit: cover` and `object-position: center` to ensure a predictable central crop on mobile, respecting the "safe area" concept for designers.
- **Placeholders**: Neutral and discrete placeholders for images and logo.
- **Architectural Integrity**: Preserving existing TanStack Start/Router setup and Auth logic.
