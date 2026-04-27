#!/usr/bin/env node
/**
 * Guideline Ingestion Script
 * 
 * Usage:
 *   npx tsx scripts/ingest.ts                    # ingest all PDFs found in guidelines/pdfs/
 *   npx tsx scripts/ingest.ts --id ICH-Q10       # ingest specific guideline by ID
 *   npx tsx scripts/ingest.ts --list             # list ingestion status
 * 
 * After ingestion, update ingested: true for the guideline in src/lib/guidelines-registry.ts
 */

import fs from "fs";
import path from "path";
import { Index } from "@upstash/vector";
// @ts-ignore
import pdfParse from "pdf-parse";
import { GUIDELINES, type Guideline } from "../src/lib/guidelines-registry";

// Load env
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  }
}

const CHUNK_SIZE = 500; // tokens approx (characters / 4)
const CHUNK_OVERLAP = 50;
const PDFS_DIR = path.join(process.cwd(), "guidelines", "pdfs");

function chunkText(text: string, chunkSize = CHUNK_SIZE * 4, overlap = CHUNK_OVERLAP * 4): string[] {
  const chunks: string[] = [];
  let start = 0;

  // Clean text
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\f/g, "\n")
    .trim();

  while (start < cleaned.length) {
    let end = start + chunkSize;

    // Try to break at sentence boundary
    if (end < cleaned.length) {
      const breakPoint = cleaned.lastIndexOf(". ", end);
      if (breakPoint > start + chunkSize / 2) {
        end = breakPoint + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }
    start = end - overlap;
  }

  return chunks;
}

async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("Missing NVIDIA_API_KEY in .env.local");

  const response = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: "nvidia/nv-embedqa-e5-v5",
      input_type: "passage",
      encoding_format: "float",
      truncate: "END",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA embedding error: ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

function detectSection(text: string): string {
  // Try to extract section number from chunk text
  const match = text.match(/^(\d+(\.\d+)*\.?\s+[A-Z][^.]{3,60})/m);
  if (match) return match[1].trim().slice(0, 80);
  return "General";
}

async function ingestGuideline(guideline: Guideline, index: Index): Promise<void> {
  const pdfPath = path.join(PDFS_DIR, guideline.fileName);

  if (!fs.existsSync(pdfPath)) {
    console.log(`  SKIP: ${guideline.fileName} not found in guidelines/pdfs/`);
    return;
  }

  console.log(`\nIngesting: ${guideline.shortName} (${guideline.fileName})`);

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);
  const fullText = pdfData.text;

  console.log(`  Extracted ${fullText.length} characters`);

  const chunks = chunkText(fullText);
  console.log(`  Created ${chunks.length} chunks`);

  // Batch upsert (Upstash supports up to 1000 per request)
  const BATCH_SIZE = 50;
  let ingested = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const vectors = [];

    for (let j = 0; j < batch.length; j++) {
      const chunkIndex = i + j;
      const chunkText = batch[j];

      try {
        const embedding = await embedText(chunkText);
        vectors.push({
          id: `${guideline.id}-chunk-${String(chunkIndex).padStart(4, "0")}`,
          vector: embedding,
          metadata: {
            source: guideline.shortName,
            guidelineId: guideline.id,
            category: guideline.category,
            title: guideline.name,
            section: detectSection(chunkText),
            chunkIndex,
            text: chunkText,
            // Add explicit reference for LLM citations
            guidelineReference: guideline.shortName,
          },
        });

        process.stdout.write(`\r  Embedding chunk ${chunkIndex + 1}/${chunks.length}...`);
      } catch (err) {
        console.error(`\n  Error embedding chunk ${chunkIndex}:`, err);
      }
    }

    if (vectors.length > 0) {
      await index.upsert(vectors);
      ingested += vectors.length;
    }

    // Rate limit: small delay between batches
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n  Done. Ingested ${ingested} chunks for ${guideline.shortName}`);
  console.log(`  ACTION REQUIRED: Set ingested: true for "${guideline.id}" in src/lib/guidelines-registry.ts`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    console.log("\nGuideline Ingestion Status:");
    console.log("─".repeat(60));
    for (const g of GUIDELINES) {
      const pdfExists = fs.existsSync(path.join(PDFS_DIR, g.fileName));
      const status = g.ingested ? "INGESTED" : pdfExists ? "PDF READY" : "NO PDF";
      console.log(`  [${status.padEnd(10)}] ${g.shortName} (${g.fileName})`);
    }
    console.log("");
    return;
  }

  // Validate env
  if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY not set in .env.local");
  if (!process.env.UPSTASH_VECTOR_REST_URL) throw new Error("UPSTASH_VECTOR_REST_URL not set");
  if (!process.env.UPSTASH_VECTOR_REST_TOKEN) throw new Error("UPSTASH_VECTOR_REST_TOKEN not set");

  const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });

  const targetId = args.find((a) => a !== "--id")
    ? args[args.indexOf("--id") + 1]
    : null;

  if (targetId) {
    const guideline = GUIDELINES.find((g) => g.id === targetId);
    if (!guideline) {
      console.error(`Guideline ID "${targetId}" not found in registry.`);
      process.exit(1);
    }
    await ingestGuideline(guideline, index);
  } else {
    // Ingest all that have PDFs
    const available = GUIDELINES.filter((g) =>
      fs.existsSync(path.join(PDFS_DIR, g.fileName))
    );

    if (available.length === 0) {
      console.log("No PDFs found in guidelines/pdfs/. Add PDFs using the filenames from guidelines-registry.ts");
      return;
    }

    console.log(`Found ${available.length} PDFs to ingest.`);
    for (const g of available) {
      await ingestGuideline(g, index);
    }
  }

  console.log("\nIngestion complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
