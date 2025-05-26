# Tech Stack Document for CSV-Driven Review Generator Agent

This document explains in simple terms the technology choices behind our system that turns four CSV files into batches of natural, human-like reviews. No deep technical knowledge is needed—just the “why” and “how” of each piece.

## 1. Frontend Technologies

Our user interface (what you see and interact with in the browser) is built with tools that make it fast, responsive, and easy to update:

- **Next.js (React + TypeScript)**
  - A popular framework that lets us build pages that feel instant and run smoothly.
  - TypeScript adds a safety net by checking our code for mistakes before we even run it.
- **Tailwind CSS**
  - A set of simple styling rules so we don’t spend time writing custom CSS.
  - Ensures consistent spacing, colors, and typography across the app.
- **shadcn/ui**
  - Pre-made, accessible components (buttons, sliders, forms) that look good out of the box.
- **Netlify (Hosting)**
  - Automatically builds and publishes our frontend whenever we update the code.
  - Serves the site through a global CDN so pages load quickly no matter where you are.

Together, these choices let us deliver a clean, drag-and-drop interface that responds in under half a second, whether you’re previewing CSVs or watching reviews generate.

## 2. Backend Technologies

Behind the scenes, we have a small set of services and libraries that handle your CSV uploads, talk to the AI, and store results:

- **Mastra Framework**
  - Organizes our backend into four “agents” (CSVParser, PromptBuilder, ReviewGenerator, QualityController).
  - Each agent has a clear job, making the code easier to maintain and extend.
- **Node.js + TypeScript**
  - Runs our agents server-side, using the same typed code style as the frontend.
- **Anthropic Claude Sonnet 4 API**
  - The AI engine that actually generates the reviews based on prompts we build from your CSV data.
  - We send it a short message, and it returns a batch of human-like text.
- **Supabase (PostgreSQL)**
  - A managed database that stores your CSV settings and the generated reviews.
  - No need to run or patch our own database servers—Supabase handles reliability and backups.

When you upload CSVs, our CSVParser agent reads and validates them. The PromptBuilder turns that data into a single AI prompt. The ReviewGenerator sends that prompt to Claude and retrieves raw reviews. Finally, QualityController scores and filters them before saving to Supabase.

## 3. Infrastructure and Deployment

To keep the system reliable and easy to update, we rely on cloud services and version control:

- **Git & GitHub**
  - Every change to our code is tracked in Git. GitHub stores that history and lets us roll back if needed.
- **Netlify CI/CD**
  - On each push to our main branch, Netlify automatically builds the frontend and deploys it.
  - Netlify Functions run our backend agents as serverless functions—no servers to manage or patch.
- **Supabase**
  - Hosts our PostgreSQL database in the cloud, scaling up automatically as we grow.

This setup means zero downtime for updates, easy rollbacks, and scaling that adjusts to our usage without manual intervention.

## 4. Third-Party Integrations

Rather than building everything from scratch, we integrate with trusted services:

- **Anthropic Claude Sonnet 4 API** — High-quality AI for generating reviews.
- **Supabase** — Cloud database with real-time sync and secure storage.
- **Netlify** — Hosting, global CDN, and serverless functions for our backend code.
- **Cursor** — An IDE plugin for our developers (not visible in production) that offers AI-powered coding suggestions.

These integrations let us focus on user experience and review quality, while the services handle uptime, security, and performance.

## 5. Security and Performance Considerations

We’ve built security and speed into every layer of the tech stack:

Security Measures
- **HTTPS everywhere**: all data is encrypted in transit.
- **CSV validation & sanitization**: we check every CSV file against a schema and strip out any unexpected content to prevent injection attacks.
- **Secure environment variables**: API keys for Claude and Supabase are stored securely in Netlify’s settings, never exposed in code.
- **Database rules**: Supabase’s built-in permissions ensure only our code can read or write data.

Performance Optimizations
- **Global CDN**: Netlify serves static assets (HTML, CSS, JavaScript) from servers close to the user.
- **Serverless scaling**: Netlify Functions spin up on demand, so generating 100 reviews in one batch just uses more function calls—no slowdowns for other users.
- **Asynchronous processing**: generating reviews happens in the background, with a progress bar updating in real time.
- **Efficient queries**: We only fetch the data we need from Supabase, keeping database calls fast.

Together, these steps ensure the app remains fast and secure, even under load.

## 6. Conclusion and Overall Tech Stack Summary

Here’s a quick recap of our key technology choices and why they fit the project goals:

- **Frontend**: Next.js + React + TypeScript for speed and safety; Tailwind CSS + shadcn/ui for a clean, consistent look; hosted on Netlify for instant builds and global delivery.
- **Backend**: Mastra Framework organizes our AI agents; Node.js + TypeScript for shared code style; Claude Sonnet 4 API for best-in-class review generation; Supabase for a managed, scalable database.
- **Infrastructure**: GitHub + Netlify CI/CD for automatic builds, zero-downtime deploys, and serverless backend code.
- **Integrations**: Third-party services (Anthropic, Supabase, Netlify) handle heavy lifting—security, uptime, scaling—so we can focus on core features.
- **Security & Performance**: HTTPS, CSV validation, safe key storage, CDN, serverless scaling, and lean database queries combine to keep the system robust and snappy.

This technology stack aligns perfectly with our goals: letting a single user upload four CSV files and, within seconds, get dozens of high-quality, AI-powered reviews—no technical setup required, just drop your CSVs and go.