# Plan: Refinement of BIGofertas Header Visuals and Responsiveness

Enhance the Header and Category Navigation to achieve a professional e-commerce aesthetic, strictly following the BIGofertas identity (Red, White, Black) while maintaining the approved promotional banner structure.

## Technical Details

### 1. Header Desktop Refinement
- **File:** `src/components/layout/Header.tsx`
- **Container:** Ensure `max-w-7xl mx-auto` is used consistently for content.
- **Search Bar:** Increase prominence. Refine border (thin), radius (discrete), and focus states. Ensure lupine icon alignment.
- **Actions (Right Group):** Balance "Minha Conta" (User icon + text) and "Carrinho" (Cart icon). Align vertically and horizontally. Add subtle red hover effects.
- **Logo Area:** Maintain placeholder presence, ensuring perfect vertical alignment with search and actions.

### 2. Header Mobile Optimization
- **File:** `src/components/layout/Header.tsx`
- **Layout:** Top row with Hamburger (left), Logo (center), and Icons (right).
- **Icons:** Show only icons (User, Cart) on mobile if space is tight.
- **Search:** Position a full-width search bar on a second row below the main header line.
- **Responsiveness:** Test at 1440px, 1280px, 768px, and 390px to prevent overflow and ensure usability.

### 3. Category Navigation Refinement
- **File:** `src/components/layout/CategoryNav.tsx`
- **Typography:** Adjust font size/weight and letter-spacing for a professional look.
- **Interactions:** Refine the red hover indicator (underline/bottom bar) and persistent active state for "INÍCIO".
- **Separation:** Add discrete horizontal borders between Header and CategoryNav.

### 4. Constraints (Mandatory)
- **Promotional Banners:** NO changes to `src/routes/index.tsx` regarding banner sizes, ratios, or positions.
- **Backend:** NO changes to Supabase, Auth, or existing logic.
- **Content:** NO new functional features (no real search, no real cart, no new categories).

---
*I will proceed with these refinements once approved.*
