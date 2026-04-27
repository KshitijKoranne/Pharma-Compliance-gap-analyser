import { Index } from "@upstash/vector";

let _index: Index | null = null;

export function getVectorIndex(): Index {
  if (!_index) {
    if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
      throw new Error("Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN");
    }
    _index = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });
  }
  return _index;
}

export interface GuidelineChunkMetadata {
  source: string;           // e.g. "ICH Q10"
  guidelineId: string;      // e.g. "ICH-Q10"
  guidelineReference: string; // same as source, for LLM citation
  category: string;         // e.g. "ICH"
  title: string;            // full guideline title
  section: string;          // e.g. "4.2 Management Review"
  chunkIndex: number;
  text: string;             // the actual chunk text
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: GuidelineChunkMetadata;
}

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("Missing NVIDIA_API_KEY");

  const response = await fetch(
    "https://integrate.api.nvidia.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: "nvidia/nv-embedqa-e5-v5",
        input_type: "query",
        encoding_format: "float",
        truncate: "END",
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA embedding error: ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function searchGuidelines(
  queryText: string,
  guidelineIds: string[],
  topK: number = 10
): Promise<SearchResult[]> {
  const index = getVectorIndex();
  const queryVector = await embedText(queryText);

  const filter =
    guidelineIds.length > 0
      ? `guidelineId IN (${guidelineIds.map((id) => `'${id}'`).join(", ")})`
      : undefined;

  const results = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter,
  });

  return results
    .filter((r) => r.metadata)
    .map((r) => ({
      id: r.id as string,
      score: r.score,
      metadata: r.metadata as unknown as GuidelineChunkMetadata,
    }));
}
