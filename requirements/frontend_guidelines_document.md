# Frontend Guideline Document

This document explains how the frontend of the **CSV-Driven Review Generator Agent** is built, what design principles guide it, and how everything fits together. It’s written in everyday language so anyone can understand it.

## 1. Frontend Architecture

### Overview
- **Framework**: Next.js (React-based) with TypeScript.
- **Styling**: Tailwind CSS with shadcn/ui component library.
- **Hosting**: Netlify for continuous deployment and global CDN.
- **API Layer**: Communicates with Mastra agents via REST endpoints; stores results in Supabase (PostgreSQL).

### How It Supports Scalability, Maintainability, Performance
- **Scalability**: Next.js’s serverless functions and Netlify’s auto-scaling handle bursts of generation requests. Static pages and assets are served from the CDN.
- **Maintainability**: TypeScript catches errors early. Components live in a clear folder structure (`/components`, `/hooks`, `/pages`). Shared logic (API calls, state) is centralized in `/lib` or React Context.
- **Performance**: Next.js does code splitting by default. Tailwind’s JIT compiler produces only the CSS you use. Netlify’s CDN ensures fast load times worldwide.

## 2. Design Principles

1. **Usability**: Simple drag-and-drop CSV upload, clear sliders and dropdowns for settings, real-time feedback during generation.
2. **Accessibility**: All interactive elements use semantic HTML, focus states, and ARIA labels. Colors meet WCAG AA contrast ratios.
3. **Responsiveness**: Flexible layouts built with Tailwind’s utility classes ensure the UI works on desktop, tablet, and mobile.
4. **Consistency**: shadcn/ui provides a consistent set of buttons, inputs, modals, and notifications.

*How it’s applied:* Every form field has labels and helper text. Error messages appear near the field. Buttons have clear disabled states and hover effects.

## 3. Styling and Theming

### Styling Approach
- **Tool**: Tailwind CSS (utility-first).
- **Component Library**: shadcn/ui for reusable, accessible React components.
- **No BEM/SMACSS**: Tailwind’s class names replace manual CSS file organization.

### Theming
- **Light mode only** (Japanese market, minimal branding).
- **Customizable colors** via Tailwind’s `theme.extend` in `tailwind.config.js`.

### Visual Style
- **Overall**: Modern flat design with soft edges and subtle shadows (glassmorphism hints in modals).
- **Primary Font**: ‘Noto Sans JP’, fallback `sans-serif` (for crisp Japanese text).

### Color Palette
| Name          | Hex       | Usage                     |
| ------------- | --------- | ------------------------- |
| Primary       | #3B82F6   | Primary buttons, links    |
| Secondary     | #10B981   | Success states, sliders   |
| Accent        | #F59E0B   | Highlights, tooltips      |
| Neutral Light | #F3F4F6   | Backgrounds               |
| Neutral Dark  | #374151   | Text, icons               |
| Error         | #EF4444   | Validation messages       |


## 4. Component Structure

- **Folder Layout**:
  - `/pages` – Next.js page files (e.g., `index.tsx`, `sessions/[id].tsx`).
  - `/components` – Shared UI components, organized by type:
    - `atoms/` – Buttons, Inputs, Labels.
    - `molecules/` – Form groups, card items.
    - `organisms/` – CSV upload section, generation settings panel, results table.
  - `/hooks` – Custom React hooks (e.g., `useCsvUpload`, `useGeneration`).
  - `/lib/api.ts` – Functions for API calls.
  - `/context` – React Context providers (e.g., Theme, Session).

- **Reusability**: Each component has clear props and minimal internal state. Complex logic lives in hooks or context.

## 5. State Management

- **Local State**: React’s `useState` and `useReducer` inside components for UI interactions (e.g., file selection, slider value).
- **Shared State / Server Data**:
  - **React Query** (TanStack Query) for fetching and caching generation results and session data.
  - **Context API** for global settings (e.g., current session ID, theme).

This ensures a snappy UI without prop drilling, and data stays in sync across components.

## 6. Routing and Navigation

- **Next.js Routing**: File-based routing. Key routes:
  - `/` – Landing page with CSV upload and settings.
  - `/sessions/[sessionId]` – Review generation progress and results.
- **Navigation**: Simple header with links to “New Generation” and recent sessions. Uses Next.js `Link` for prefetching.
- **Dynamic Routes**: `[sessionId]` allows direct linking to past sessions.

## 7. Performance Optimization

1. **Lazy Loading**: Dynamically import heavy components (e.g., the results table) with Next.js `next/dynamic`.
2. **Code Splitting**: Next.js splits by route; only needed JavaScript loads per page.
3. **Asset Optimization**: SVG icons via `@heroicons/react`, no large images.
4. **Tailwind JIT**: Generates only used CSS classes.
5. **Debounced Inputs**: Debounce CPU-intensive tasks (e.g., validation) to keep UI responsive.
6. **Streaming Updates**: Show progress in real time as reviews come back from the API, avoiding full-page refreshes.

## 8. Testing and Quality Assurance

- **Unit & Integration Tests**: Jest + React Testing Library for components and hooks. Focus on:
  - CSV upload validation.
  - Prompt text generation UI logic.
  - Settings form edge cases.
- **End-to-End (E2E) Tests**: Cypress tests to cover:
  - Full CSV upload → review generation flow.
  - Error states (bad CSV, API failures).
- **Linting & Formatting**:
  - ESLint with TypeScript rules.
  - Prettier for consistent code style.
- **Continuous Integration**: Netlify builds run tests on every pull request.

## 9. Conclusion and Overall Frontend Summary

This frontend uses Next.js + TypeScript + Tailwind CSS + shadcn/ui to deliver a fast, reliable, and easy-to-use interface for generating human-like reviews from CSV files. We follow clear design principles—usability, accessibility, responsiveness—and a modern flat style with Japanese typography. Component-based architecture, React Query, and Next.js features ensure the app scales and stays maintainable. Automated tests and performance optimizations keep quality high and the user experience smooth.  

By sticking to these guidelines, any developer can quickly understand, extend, and maintain the frontend, ensuring that the **CSV-Driven Review Generator Agent** stays robust and user-friendly.