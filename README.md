# Our Memory — Private Shared Digital Memory Vault

**Our Memory** is a private, shared digital memory vault designed for two people (expandable to multi-member spaces). The application permanently stores all original memories (notes, thoughts, photos, links, documents, and files) in a PostgreSQL database and Supabase Storage. **Google Gemini** powers an optional server-side search and Q&A layer with strict anti-hallucination guardrails and interactive source memory citations.

---

## Key Features

- 🔐 **Private 2-Person Shared Memory Space**: Onboarding allows creating a space or joining your partner via a unique 6-character Invite Code (e.g., `MEM-8X92`).
- ⚡ **Fast Multi-Format Capture (+ Add Memory)**:
  - **Text**: Write notes, ideas, thoughts, or reminders.
  - **Image**: Multi-photo upload with non-blocking Gemini Vision descriptions.
  - **Link**: Save URLs with domain parsing and personal commentary.
  - **File**: Secure document uploads (PDF, DOCX, TXT, etc.).
- 📅 **Chronological Timeline**: Grouped automatically by `TODAY`, `YESTERDAY`, or exact dates.
- 🏷️ **Tagging & Filtering**: Quick filter chips by type (Notes, Images, Links, Files, Mine) or custom `#tags`.
- 💭 **Ask Our Memory (Server-Side Gemini AI)**:
  - Searches database memories and synthesizes answers using Google Gemini.
  - Enforces strict anti-hallucination guardrails (only answers using retrieved data).
  - Displays **clickable original source memory references**.
  - **Optional AI Fallback**: If `GEMINI_API_KEY` is not present, normal search and memory retrieval remain 100% functional.
- 🎨 **Premium Graphite UI**: Built with Next.js 15 App Router, Tailwind CSS, Lucide Icons, and Framer Motion micro-interactions.

---

## Tech Stack

- **Framework**: Next.js 15+ (App Router, Server Actions, TypeScript)
- **Styling**: Tailwind CSS (Dark Graphite `#0B0C0E` + Electric Lime `#C6FF00`)
- **Database & Auth**: Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS)
- **File Storage**: Supabase Storage (`memory-files` bucket)
- **AI Engine**: Google Gemini API (`@google/genai` server-side SDK)
- **Deployment**: Vercel ready

---

## Environment Variables Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Gemini API Key (Server-Side Only)
GEMINI_API_KEY=your-gemini-api-key
```

> **Note**: `GEMINI_API_KEY` is optional. If missing, all memory creation, timeline viewing, attachments, tag filtering, and keyword search continue working seamlessly.

---

## Supabase Database Setup

1. Log into your [Supabase Dashboard](https://supabase.com) and create a new project.
2. Go to **SQL Editor** -> **New Query**.
3. Copy the full contents of `supabase/schema.sql` and run it.
4. This script automatically provisions:
   - `profiles`, `spaces`, `space_members`, `memories`, `attachments`, `tags`, and `memory_tags` tables.
   - Indexes for fast timeline filtering.
   - User creation triggers.
   - Row Level Security (RLS) policies ensuring cross-space data privacy.
   - Private Supabase Storage bucket `memory-files`.

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the local dev server**:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment to Vercel

1. Push your code to GitHub / GitLab.
2. Import the repository into [Vercel](https://vercel.com).
3. Add environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).
4. Click **Deploy**.

Alternatively using Vercel CLI:
```bash
vercel --prod
```
