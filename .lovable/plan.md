# Plan - Frontend Phase 2 (BIGofertas)

Implement the top visual structure of the home page, including promotional slots and the main header, following the specific architectural rules and visual style requested.

## Proposed Changes

### 1. Components Creation
- Create `src/components/layout/PromoBanner.tsx`: A reusable component for PNG promotional banners with responsive behavior and centralized mobile cropping.
- Create `src/components/layout/Header.tsx`: The main e-commerce header featuring a search bar, account/cart links, and category navigation.
- Create `src/components/layout/CategoryNav.tsx`: Horizontal category navigation for desktop.
- Create `src/components/layout/MobileHeader.tsx`: Specific mobile layout for the header as requested.

### 2. Header Implementation
- **Desktop**: Horizontal layout with Logo, Search Bar (centered), User/Account, and Cart. Below that, the horizontal category navigation.
- **Mobile**: Main line with Hamburger menu (left), Logo (center), and Account/Cart (right). Below that, a full-width search bar.
- **Visual Style**: Clean e-commerce, predominantly white background, red/white/black palette, professional finish, no generic AI aesthetics.

### 3. Promotional Arts
- **Slot 1 (Superior)**: Above the header.
- **Slot 2 (Inferior)**: Below the header and category navigation.
- Both will be image-only slots (PNG) prepared for future CMS integration.

### 4. Home Page Update
- Modify `src/routes/index.tsx` to replace the placeholder with the new top structure: `PromoBanner` (Superior) -> `Header` -> `PromoBanner` (Inferior) -> `Neutral Space`.

## Technical Details

- **Responsive Design**: Using Tailwind CSS 4 breakpoints.
- **Icons**: Using `lucide-react`.
- **Architectural Integrity**: Preserving existing TanStack Start/Router setup and Auth logic.
- **Images**: Using placeholders for PNG banners and logo until official assets are provided.
- **Max Width**: Implementing a professional container width (e.g., `max-w-7xl mx-auto`).
