# Step-by-Step Implementation Guide for CSV-Driven Review Generator Agent

This guide walks you through building the project from start to finish. Each major step is broken down into smaller tasks. Follow them in order to get a working system.

## 1. Project Kickoff and Environment Setup
1. Create a new repository and initialize with Git.
2. Set up project folders:
   - `/backend` for Mastra agents and API code
   - `/frontend` for Next.js UI
3. Configure TypeScript in both folders (`tsconfig.json`).
4. Install basic dependencies:
   - Backend: `npm install mastra @anthropic-ai/sdk supabase-js express cors dotenv`
   - Frontend: `npm install next react react-dom typescript tailwindcss shadcn/ui`
5. Create environment files (`.env`) for API keys and database URLs:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
6. Commit and push the initial structure to your repo.

## 2. Database Provisioning (Supabase)
1. Sign in to Supabase and create a new project.
2. Create two tables via SQL editor or Supabase UI:
   - **generation_sessions**
     • `id` (UUID, primary key)
     • `created_at` (timestamp)
     • `csv_config` (JSONB)
   - **generated_reviews**
     • `id` (UUID, primary key)
     • `session_id` (UUID, foreign key → generation_sessions.id)
     • `review_text` (text)
     • `age_group` (text)
     • `gender` (text)
     • `quality_score` (numeric)
     • `created_at` (timestamp)
3. Note down the table schemas; you’ll use them in your ORM or SQL queries.
4. Set up Supabase client in the backend:
   - Initialize `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.

## 3. CSV Parsing Module (CSVParserAgent)
1. In `/backend/src/agents/CSVParserAgent.ts` create a class with methods to:
   - Accept and read four CSV files (`keywords`, `patterns`, `examples`, `quality_rules`).
   - Validate required headers and data types.
   - Transform each CSV into a JavaScript object or array.
2. Use a CSV library (e.g., `csv-parse`) to handle parsing.
3. Write unit tests to ensure invalid CSVs throw descriptive errors.

## 4. Prompt Builder Module (DynamicPromptBuilderAgent)
1. In `/backend/src/agents/DynamicPromptBuilderAgent.ts` implement:
   - A method that takes parsed CSV data from CSVParserAgent.
   - Logic to assemble a prompt string for Claude Sonnet:
     • Insert required keywords.
     • Apply tone/vocabulary from `patterns.csv` based on a random age/gender sample.
     • Enforce prohibited keywords exclusion.
     • Append quality rules from `quality_rules.csv` as instructions.
2. Add configuration options to tweak prompt templates via environment variables if needed.
3. Write tests to confirm the prompt includes or omits keywords correctly.

## 5. Review Generation Module (ReviewGeneratorAgent)
1. In `/backend/src/agents/ReviewGeneratorAgent.ts` implement:
   - A method to call the Claude API with the prompt:
     • Use the Anthropic SDK to send and receive messages.
     • Parse the AI response into discrete review texts.
   - Error handling for timeouts or API failures.
2. Integrate `QualityControllerAgent` (next step) to validate or reject each review.
3. Store successful reviews to the `generated_reviews` table in Supabase.

## 6. Quality Control Module (QualityControllerAgent)
1. In `/backend/src/agents/QualityControllerAgent.ts`, build:
   - A naturalness scoring function (you may call an internal heuristic or another AI check).
   - Rules enforcement:
     • Check presence of required keywords.
     • Check absence of prohibited expressions.
     • Minimum naturalness score threshold.
2. If a review fails, flag it and optionally trigger regeneration in ReviewGeneratorAgent.
3. Write tests to cover boundary cases (e.g., missing required keyword).

## 7. Backend API and Endpoint Design
1. Create an Express (or Fastify) server in `/backend/src/server.ts`.
2. Define routes:
   - `POST /api/upload`:
     • Accept multipart form data with four CSV files.
     • Call CSVParserAgent, store `csv_config` in `generation_sessions`, return `session_id`.
   - `POST /api/generate`:
     • Body: `{ session_id, prompt_override?, count }`.
     • Retrieve CSV config, build prompts, generate `count` reviews.
     • Stream progress via WebSockets or Server-Sent Events for real–time UI updates.
     • Return final list and quality scores.
   - `GET /api/reviews/:session_id`:
     • Fetch stored reviews from Supabase for display or CSV download.
   - `POST /api/review/:review_id/regenerate`:
     • Trigger regeneration for a single review.
3. Add CORS, JSON body parsing, and error-handling middleware.
4. Write integration tests (e.g., using Jest + Supertest).

## 8. Frontend Integration (Next.js)
1. In `/frontend`, configure pages:
   - `/` Upload page with drag-and-drop CSV area.
   - `/generate` Review generation UI with prompt override textarea.
   - `/results` Display reviews, progress bar, and download button.
2. Use React Hooks to call backend endpoints:
   - Show validation errors from `/api/upload`.
   - Use EventSource or WebSocket for live progress from `/api/generate`.
3. Implement components with Tailwind CSS and shadcn/ui.
4. Test UI performance; ensure interactions are under 0.5s.

## 9. AI Model Integration (Anthropic Claude)
1. Wrap Anthropics calls in a reusable service module.
2. Handle rate limits and retries (exponential backoff).
3. Monitor token and cost usage; configure proper model settings.

## 10. Performance and Scaling Considerations
1. Batch AI requests where possible to reduce round–trips.
2. Cache static CSV configs in memory per session.
3. Limit concurrent generation jobs per user/session.
4. Use Supabase Edge Functions if you need ultra–low latency DB operations.

## 11. Security and Error Handling
1. Validate and sanitize all inputs, especially CSV file contents.
2. Authenticate API calls if the system requires user accounts.
3. Store secrets in environment variables; never check them into Git.
4. Use HTTPS in production.
5. Implement global error handlers to return friendly messages.

## 12. Deployment and Hosting
1. Backend:
   - Containerize with Docker (`Dockerfile` + `docker-compose`).
   - Deploy to a cloud provider (e.g., AWS ECS, GCP Cloud Run, or Vercel Serverless Functions).
2. Frontend:
   - Deploy to Netlify or Vercel.
3. Set up CI/CD pipeline to lint, test, build, and deploy on push to `main`.

## 13. Monitoring, Logging, and Maintenance
1. Integrate a monitoring service (e.g., Datadog, CloudWatch, or Supabase logs).
2. Log key events: upload, generation start/end, failures.
3. Set up alerts for error rates or latency spikes.
4. Schedule periodic dependency updates and security audits.

## 14. Final Testing and Launch Checklist
1. Verify CSV upload, generation, and download flows end to end.
2. Test edge cases (invalid CSVs, API timeouts).
3. Measure performance against goals:
   - 20 reviews in under 2 minutes
   - CSV parsing under 5 seconds
4. Confirm quality metrics (AI detection avoidance, naturalness scores).
5. Launch and monitor for the first 48 hours.

—
By following these steps in order, you’ll build a robust, scalable CSV-Driven Review Generator Agent that meets the project’s performance, quality, and usability goals. Good luck!