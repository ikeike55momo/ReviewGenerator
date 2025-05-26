# Implementation plan

## Phase 1: Environment Setup

1. **Prevalidation**: Check if `package.json` exists in project root; if yes, skip initialization, otherwise proceed with Step 2. (ref Project Overview)
2. Initialize a Git repository in project root: run `git rev-parse --is-inside-work-tree` and if false, `git init`. (ref Project Overview)
3. Create a `.gitignore` file at project root containing:
   - `node_modules/`
   - `.cursor/`
   - `.cursor/mcp.json`
   (ref Project Overview)
4. Install Node.js v20.2.1. (ref Technical Stack: Backend & Agents)
5. **Validation**: Run `node -v` to confirm version v20.2.1. (ref Technical Stack: Backend & Agents)
6. Initialize `package.json` by running `npm init -y`. (ref Project Overview)
7. Create a `cursor_metrics.md` file in project root. (ref Instruction Phase 1)
8. Refer to `cursor_project_rules.mdc` to understand how to populate `cursor_metrics.md`. (ref Instruction Phase 1)
9. Create a `.cursor` directory in project root. (ref Instruction Phase 1)
10. Create a `.cursor/mcp.json` file inside the `.cursor` directory. (ref Instruction Phase 1)
11. Add `.cursor/` and `.cursor/mcp.json` to `.gitignore`. (ref Instruction Phase 1)
12. Insert the following placeholder configuration into `.cursor/mcp.json`:
    ```json
    {
      "mcpServers": {
        "supabase": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-postgres", "<connection-string>"]
        }
      }
    }
    ```
    (ref Instruction Phase 1)
13. Display link for user to obtain Supabase MCP connection string:
    https://supabase.com/docs/guides/getting-started/mcp#connect-to-supabase-using-mcp (ref Instruction Phase 1)
14. Prompt the user to copy their Supabase connection string from the link into `.cursor/mcp.json` in place of `<connection-string>`. (ref Instruction Phase 1)
15. In Supabase dashboard, navigate to **Settings > MCP** and confirm the MCP server shows green “active” status. (ref Instruction Phase 1)
16. **Validation**: In your LLM-driven IDE (e.g., Cursor), open **Settings/MCP** and verify the Supabase entry is active. (ref Instruction Phase 1)
17. Install project-level dev tools for frontend and styling:
    ```bash
    npm install --save-dev typescript tailwindcss shadcn/ui
    npx tailwindcss init -p
    ```
    (ref Technical Stack: Frontend)

---

## Phase 2: Frontend Development

18. **Prevalidation**: Check if `/frontend` exists; if yes, skip Step 19, otherwise create `/frontend` directory. (ref App Flow)
19. Scaffold a Next.js 14 TypeScript app in `/frontend` by running:
    ```bash
    cd frontend
    npx create-next-app@14 . --typescript
    ```
    *Note: Next.js 14 is required for LLM-friendly tooling.* (ref Technical Stack: Frontend)
20. **Validation**: Confirm that `/frontend/next.config.js` and `/frontend/tsconfig.json` exist. (ref Technical Stack: Frontend)
21. In `/frontend`, install UI dependencies:
    ```bash
    npm install tailwindcss shadcn/ui react-dropzone
    ```
    (ref Technical Stack: Frontend + Core Features: CSV-Driven Review Generation)
22. Initialize Tailwind CSS in `/frontend` by running `npx tailwindcss init -p`. (ref Technical Stack: Frontend)
23. Update `/frontend/tailwind.config.js` to scan your source files:
    ```js
    /** @type {import('tailwindcss').Config} */
    module.exports = {
      content: ['./src/**/*.{js,ts,jsx,tsx}'],
      theme: { extend: {} },
      plugins: [],
    };
    ```
    (ref Technical Stack: Frontend)
24. Create `/frontend/src/app/layout.tsx` with basic HTML boilerplate and global stylesheet import. (ref User Interface Considerations)
25. Create `/frontend/src/app/page.tsx` with placeholders for:
    - Store selection dropdown (ref User Interface Considerations)
    - `<CSVUploader />` component
    - `<GenerationControls />` component
    - `<ReviewList />` component
26. Create `/frontend/src/components/CSVUploader.tsx` implementing drag-and-drop upload UI for four CSVs (`basic_rules.csv`, `human_patterns.csv`, `qa_knowledge.csv`, `success_examples.csv`) with file-type validation and preview grid. (ref CSV File Structure)
27. Create `/frontend/src/components/GenerationControls.tsx` with sliders/input for:
    - Number of reviews to generate
    - Age distribution ratio
    - Quality threshold
    (ref Core Features: Age and Gender Distribution Control)
28. Create `/frontend/src/components/ReviewList.tsx` to display live stream of generated reviews, quality score badge, and a “Regenerate” button per review. (ref Core Features: Automatic Quality Check and Human-Likeness Score)
29. Import and render `CSVUploader`, `GenerationControls`, and `ReviewList` in `/frontend/src/app/page.tsx`. (ref App Flow)
30. **Validation**: Run in `/frontend`:
    ```bash
    npm run dev
    ```
    and verify at http://localhost:3000 the dropdown, drag-and-drop area, sliders, and empty review list render correctly. (ref User Interface Considerations)

---

## Phase 3: Backend Development

31. Create `/backend` directory at project root. (ref Project Overview)
32. Initialize a Node.js project in `/backend` by running `npm init -y`. (ref Project Overview)
33. Install Mastra Framework, TypeScript, and Node types:
    ```bash
    npm install mastra mastra-cli typescript ts-node @types/node
    ```
    (ref Technical Stack: Backend & Agents)
34. Create `/backend/tsconfig.json` enabling ES modules and strict typing for Node. (ref Technical Stack: Backend & Agents)
35. Create `/backend/src/index.ts` to bootstrap a Mastra server, mount routes, and start listening on port 4000. (ref Technical Stack: Backend & Agents)
36. Install Supabase client library:
    ```bash
    npm install @supabase/supabase-js
    ```
    (ref Technical Stack: Database)
37. Create `/backend/src/config.ts` to export `SUPABASE_URL` and `SUPABASE_KEY` loaded from environment variables. (ref Data Structure)
38. Create `/backend/src/services/CSVParser.ts` to parse the four CSV inputs into JSON structures. (ref Core Features: CSV-Driven Review Generation)
39. Create `/backend/src/services/DynamicPromptBuilder.ts` to build LLM prompts using parsed CSV data and demographic ratios. (ref Core Features: Dynamic Style and Tone Adjustment)
40. Create `/backend/src/services/ReviewGenerator.ts` to call the Anthropic Claude Sonnet 4 API with built prompts and return raw text. (ref Core Features: CSV-Driven Review Generation)
41. Create `/backend/src/services/QualityController.ts` to enforce required/prohibited keyword rules, check syntax naturalness, and compute a naturalness score. (ref Core Features: Automatic Quality Check and Human-Likeness Score)
42. Create `/backend/src/routes/generate.ts` exporting a POST `/api/generate` endpoint that:
    1. Accepts multipart/form-data CSV files and slider parameters
    2. Parses CSVs via `CSVParser`
    3. Builds prompts via `DynamicPromptBuilder`
    4. Generates reviews via `ReviewGenerator`
    5. Scores reviews via `QualityController`
    6. Inserts records into Supabase
    7. Streams results back to client
    (ref App Flow)
43. Create `/backend/sql/schema.sql` containing:
    ```sql
    CREATE TABLE generation_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      csv_config JSONB NOT NULL,
      total_generated INTEGER DEFAULT 0
    );

    CREATE TABLE generated_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES generation_sessions(id),
      review TEXT NOT NULL,
      age VARCHAR(10) NOT NULL,
      gender VARCHAR(10) NOT NULL,
      quality_score DECIMAL(3,1) NOT NULL,
      generated_at TIMESTAMP DEFAULT NOW()
    );
    ```
    (ref Data Structure)
44. **Validation**: Run:
    ```bash
    supabase db push --schema ./backend/sql/schema.sql
    ```
    and confirm both tables appear in Supabase dashboard. (ref Data Structure)

---

## Phase 4: Integration & Testing

45. In `/backend/src/index.ts`, add CORS middleware to allow `http://localhost:3000`:
    ```ts
    import cors from 'cors';
    app.use(cors({ origin: 'http://localhost:3000' }));
    ```
    (ref Integration)
46. In `/frontend/src/components/CSVUploader.tsx`, implement `fetch('http://localhost:4000/api/generate', { method: 'POST', body: formData })` and pipe response into `/frontend/src/components/ReviewList.tsx`. (ref Integration)
47. **Validation**: Perform an end-to-end test by uploading sample CSV files in the UI, adjusting sliders, and verifying 20 reviews generate in ≤ 2 minutes with quality scores ≥ 8.0. (ref Non-Functional Requirements)

---

## Phase 5: Deployment

48. Frontend: Add `/frontend/netlify.toml`:
    ```toml
    [build]
      command = "npm run build"
      publish = "out"
    [functions]
      directory = "netlify-functions"
    ```
    and connect the `/frontend` repo to Netlify in `us-east-1`. (ref Technical Stack: Frontend)
49. Backend: Create `/backend/.ebextensions/node.config` for AWS Elastic Beanstalk in `us-east-1`:
    ```yaml
    option_settings:
      aws:elasticbeanstalk:container:nodejs:
        NodeVersion: 20.2.1
    ```
    then deploy via `eb init` and `eb create review-agent-backend`. (ref Technical Stack: Backend & Agents)
50. **Validation**: After deployment, run a smoke test using:
    ```bash
    curl -F "basic_rules.csv=@test/basic_rules.csv" \
         -F "human_patterns.csv=@test/human_patterns.csv" \
         -F "qa_knowledge.csv=@test/qa_knowledge.csv" \
         -F "success_examples.csv=@test/success_examples.csv" \
         -F "count=5" \
         -F "ageRatio={\"20s\":0.5,\"30s\":0.5}" \
         https://<frontend-netlify-url>/.netlify/functions/generate
    ```
    and verify HTTP 200 with JSON stream of reviews. (ref App Flow)