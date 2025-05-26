# Project Requirements Document

## 1. Project Overview

**CSV-Driven Review Generator Agent** is a web-based tool that takes four simple CSV files—keywords.csv, patterns.csv, examples.csv, and quality_rules.csv—and instantly produces a batch of human-like reviews tailored to a specific store or business. Instead of manually writing each review (which can take 5–10 minutes) or risking detection by review-filtering algorithms, this system builds dynamic AI prompts from your CSV data, sends them to an AI model, and returns polished, natural reviews that hit your quality targets.

We’re building this to save time, ensure consistency, and avoid “robotic” language that modern AI detectors flag. Key objectives for version 1.0 are:

*   Generate 1–100 reviews per run in seconds
*   Achieve at least an 8.0/10 human-naturalness score on average
*   Avoid AI-detection 95% of the time
*   Let a single user manage multiple store setups by choosing from pre-configured “boxes” of CSVs

## 2. In-Scope vs. Out-of-Scope

### In-Scope (Version 1.0)

*   Store selection dropdown with predefined CSV “boxes”
*   Drag-and-drop upload of four required CSVs
*   Immediate parsing, schema validation, and error display
*   Dynamic prompt construction based on CSV content
*   Batch review generation (1–100 reviews) via Claude Sonnet 4 API
*   Automatic age/gender ratio distribution and tone control
*   Keyword enforcement (required, recommended, prohibited)
*   Quality checks: required elements, prohibited phrases, minimum naturalness score
*   Real-time progress bar, per-review naturalness score display
*   Individual-review regeneration button
*   CSV download of final filtered reviews

### Out-of-Scope (Later Phases)

*   Multi-user accounts or role-based access control
*   Editing CSV content directly in the UI
*   Export to formats other than CSV (Excel, PDF)
*   Direct posting to external review sites or notification services
*   Support for any language other than Japanese

## 3. User Flow

A user opens the app, chooses a store from a dropdown (each store is just a container for four CSV files). Once selected, the system highlights that box and shows any previously uploaded CSV metadata. The user drags and drops the four CSVs (keywords, patterns, examples, quality rules). Instantly, the UI parses each file, shows a preview, and runs schema checks. If any CSV fails, the raw error message displays beneath that preview so the user can correct and re-upload.

After all CSVs pass validation, the system builds a dynamic AI prompt and displays it in a text field. The user can tweak that prompt if needed, then set the number of reviews (1–100) via a slider. Clicking “Generate” queues the request (first-come, first-served) and shows a progress bar. Reviews stream in one by one with their automatically computed naturalness scores. Once done, any review that didn’t meet quality thresholds disappears. The user can click a “Regenerate” icon next to any remaining review to replace it, preserving age/gender ratios. Finally, a “Download CSV” button exports the clean set of reviews, and the user can start again or switch stores.

## 4. Core Features

*   **Store Configuration Selection**\
    Predefined “boxes” for each store; selecting one loads its CSV metadata.
*   **CSV Upload & Validation**\
    Drag-and-drop for four CSVs, instant schema & content checks, raw error messages.
*   **Dynamic Prompt Builder**\
    Reads CSV data (keywords, patterns, examples, rules) to assemble an AI generation prompt.
*   **Batch Review Generator**\
    Sends prompt to Anthropic Claude Sonnet 4 API, supports 1–100 reviews per run.
*   **Age/Gender Distribution Engine**\
    Distributes reviews across specified age/gender ratios from patterns.csv.
*   **Tone & Style Controller**\
    Applies vocabulary, exclamation-mark rules, and style patterns per demographic group.
*   **Keyword & Rule Manager**\
    Enforces required keywords, recommended items, and prohibits certain phrases.
*   **Quality Controller**\
    Validates each review against quality_rules.csv: required elements, prohibited expressions, and naturalness scoring; filters out low-quality entries.
*   **UI Components**\
    Progress bar, real-time review list, per-review score, individual regen button, final CSV download.
*   **Request Queue Handling**\
    Processes generation requests strictly in arrival order.

## 5. Tech Stack & Tools

*   **Frontend**: Next.js (React framework), TypeScript, Tailwind CSS, shadcn/ui components, hosted on Netlify
*   **Backend & Agents**: Mastra Framework with Node.js/TypeScript agents (CSVParser, PromptBuilder, ReviewGenerator, QualityController)
*   **AI Model**: Claude Sonnet 4 API (Anthropic) for review generation
*   **Database**: Supabase (PostgreSQL) for storing session configs and generated reviews
*   **IDE Integration**: Cursor for AI-assisted coding and real-time suggestions

## 6. Non-Functional Requirements

*   **Performance**

    *   Generate 20 reviews in ≤ 2 minutes
    *   Parse and reflect CSV uploads in ≤ 5 seconds
    *   UI interactions (clicks, navigations) respond in ≤ 0.5 seconds

*   **Quality & Reliability**

    *   Achieve ≥ 95% AI-detection avoidance
    *   Maintain average naturalness score ≥ 8.0
    *   Ensure 100% coverage of required keywords

*   **Usability**

    *   Simple drag-and-drop interface
    *   Clear raw error messages for CSV problems
    *   Sliders and text-field controls for prompt and count

*   **Security & Compliance**

    *   Sanitize CSV inputs to prevent injection
    *   Store all data securely in Supabase
    *   Japanese language only (no multilingual complexity)

## 7. Constraints & Assumptions

*   **Single-User Only**: No login or roles; one operator at a time.
*   **CSV-Only Configuration**: Four CSVs define all behavior; no manual UI editing of rules.
*   **Japanese Language**: Reviews and CSVs must be in Japanese; no translation layer.
*   **Claude Sonnet 4 Availability**: Requires reliable access to the Claude API.
*   **Host Environment**: Modern browser, JavaScript enabled, Netlify for CDN and serverless functions.

## 8. Known Issues & Potential Pitfalls

*   **API Rate Limits**: If Claude’s API limit is reached, implement exponential backoff and user-friendly “Try again later” messaging.
*   **Large Batch Timeouts**: Very large runs (100 reviews) could time out; split into smaller chunks or warn user of longer wait times.
*   **CSV Schema Drift**: Users may upload malformed CSVs. Mitigation: strict schema definitions, instant raw errors, and example CSV downloads.
*   **Quality Drift Over Time**: Prompt or rule changes may cause unnatural output. Mitigation: version and snapshot CSV configs, allow prompt tweak in UI for fine-tuning.
*   **Monotony in Generated Text**: AI may repeat patterns. Mitigation: enforce vocabulary variation rules and random seed controls in prompt.

This PRD provides a clear, unambiguous blueprint of the CSV-Driven Review Generator Agent. It covers what we build today, how users interact step by step, all core modules, the tech stack, performance targets, environment assumptions, and known technical challenges—ensuring any next-stage document (technical design, frontend guidelines, backend structure) can be created without guesswork.
