

# Add Dark Mode Toggle to Navbars

## Current State
- Dark mode CSS variables already defined in `index.css` (`.dark` class)
- Tailwind configured with `darkMode: ["class"]`
- No toggle exists anywhere — dark mode is never activated

## What Changes

### 1. Create Theme Provider (`src/components/ThemeProvider.tsx`)
- React context that reads/writes `localStorage` for theme preference
- Applies/removes `dark` class on `<html>` element
- Provides `theme` and `toggleTheme` function

### 2. Add Toggle to Landing Navbar (`src/components/landing/Navbar.tsx`)
- Sun/Moon icon button next to the "Log In" button (desktop)
- Also in mobile menu
- Animated icon swap using `Moon` and `Sun` from lucide-react

### 3. Add Toggle to Dashboard TopBar (`src/components/layout/TopBar.tsx`)
- Sun/Moon icon button next to the notification bell
- Same toggle behavior

### 4. Wrap App with ThemeProvider (`src/App.tsx`)
- Wrap the entire app so all pages have access to theme context

## Files

| File | Action |
|---|---|
| `src/components/ThemeProvider.tsx` | **Create** — theme context + provider |
| `src/components/landing/Navbar.tsx` | **Edit** — add dark mode toggle button |
| `src/components/layout/TopBar.tsx` | **Edit** — add dark mode toggle button |
| `src/App.tsx` | **Edit** — wrap with ThemeProvider |

No database changes needed.

