# Plan: Create Product Detail Route

We will implement the `/product/:id` route using TanStack Router, fetching data from Supabase, and providing a high-quality product detail page.

## User Review Required

> [!IMPORTANT]
> The requirements mention using a global context for the cart. Since there is currently no global cart state or context implemented in the project, I will create a simple `CartContext` to support the "Add to Cart" functionality as requested.

## Proposed Changes

### Database & Schema
- I will check if the `products` table exists in Supabase.
- If it doesn't exist, I will ask for instructions as I am strictly forbidden from creating tables or migrations.

### Core Features

#### Cart State Management
- Create `src/context/CartContext.tsx` to manage the shopping cart state.
- Integrate `CartContext` into `src/routes/__root.tsx`.

#### Product Detail Route
- Create `src/routes/product/$id.tsx`.
- Use TanStack Router's `loader` to fetch product data from Supabase.
- Implement a responsive layout:
  - **Desktop:** 2-column layout (Image | Info).
  - **Mobile:** Single column (Image top).

#### UI Components
- **Image Gallery:** Display the main product image.
- **Product Info:** Title, price (formatted BRL), description, category, and availability badge.
- **Add to Cart:** Styled red button with success feedback (using `sonner`).
- **Specifications:** Accordion/list for product specs.
- **Navigation:** "Back" button to return to home or previous page.

### Styling & UX
- Follow BIGofertas brand identity: Red (#E60000), White, Black.
- Use Tailwind CSS v4.
- Implement smooth transitions and crossfades consistent with the existing homepage.

## Technical Details
- **Route:** `/product/$id` (dynamic parameter).
- **Data Fetching:** `context.supabase.from('products').select('*').eq('id', id).single()`.
- **State:** React Context for cart items.
- **Feedback:** `sonner` for toast notifications.

## Constraints Check
- NO database changes/migrations.
- NO changes to existing auth files.
- NO dark mode.
- Use existing `Header` and `Footer` via `__root.tsx`.
