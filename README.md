# Pharma Compliance Gap Analyser

AI-powered pharmaceutical regulatory compliance gap analysis. Upload an SOP (.docx), select guidelines, get a structured gap report.

Built under **KJR Labs** by Kshitij Koranne.

---

## Stack

- Next.js 15 + TypeScript + Tailwind
- `mammoth` — .docx parsing (serverless, no dependencies)
- Upstash Vector — RAG vector store for guideline chunks
- NVIDIA NIM — embeddings + LLM (`meta/llama-3.3-70b-instruct`)
- OpenRouter — LLM fallback

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NVIDIA_API_KEY=nvapi-...
UPSTASH_VECTOR_REST_URL=https://...
UPSTASH_VECTOR_REST_TOKEN=...
OPENROUTER_API_KEY=sk-or-v1-...
```

### 3. Add guideline PDFs

Place PDF files in `guidelines/pdfs/` using the exact filenames from `src/lib/guidelines-registry.ts`:

```
guidelines/pdfs/
  ICH_Q7.pdf
  ICH_Q9R1.pdf
  ICH_Q10.pdf
  EU_GMP_Annex11.pdf
  EU_GMP_Annex15.pdf
  FDA_21CFR_Part11.pdf
  ...
```

### 4. Ingest guidelines (run once per PDF)

```bash
# Check status
npx tsx scripts/ingest.ts --list

# Ingest all PDFs found in guidelines/pdfs/
npx tsx scripts/ingest.ts

# Ingest a specific guideline
npx tsx scripts/ingest.ts --id ICH-Q10
```

After ingestion, **set `ingested: true`** for that guideline in `src/lib/guidelines-registry.ts`.

### 5. Run the app

```bash
npm run dev
```

---

## Guidelines

PDFs are stored in `guidelines/pdfs/` in the repository. See the table in the main README for download links.

Suggested ingestion order (highest value first):
1. ICH Q7
2. ICH Q9(R1)
3. ICH Q10
4. 21 CFR Part 11
5. EU GMP Annex 11
6. EU GMP Annex 15
7. ICH Q8(R2)
8. ICH Q12
9. 21 CFR Part 211
10. FDA Process Validation 2011

---

## Deployment (Vercel)

Add all env vars in Vercel project settings. `maxDuration = 120` is set on the analysis route to handle long LLM calls.

---

## Adding a New Guideline

1. Add a new entry to `GUIDELINES` array in `src/lib/guidelines-registry.ts`
2. Place the PDF in `guidelines/pdfs/` with the correct `fileName`
3. Run `npx tsx scripts/ingest.ts --id YOUR-GUIDELINE-ID`
4. Set `ingested: true` in the registry
5. Commit and push — the guideline appears in the UI automatically
