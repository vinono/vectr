/** biome-ignore-all lint/suspicious/noConsole: "Handy for debugging" */

"use server";

import { Index, QueryMode } from "@upstash/vector";
import type { PutBlobResult } from "@vercel/blob";

type SearchResponse =
  | {
      data: PutBlobResult[];
      query: string;
    }
  | {
      error: string;
    };

const RELEVANCE_THRESHOLD = 0.74;

export const search = async (
  _prevState: SearchResponse | undefined,
  formData: FormData
): Promise<SearchResponse> => {
  const query = formData.get("search");

  if (!query || typeof query !== "string") {
    return { error: "Please enter a search query" };
  }

  try {
    console.log("Searching index for query:", query);
    const index = new Index({
      url:
        process.env.UPSTASH_SEARCH_REST_URL ||
        process.env.UPSTASH_VECTOR_REST_URL ||
        "",
      token:
        process.env.UPSTASH_SEARCH_REST_TOKEN ||
        process.env.UPSTASH_VECTOR_REST_TOKEN ||
        "",
    });
    // Use DENSE query mode (Cosine Similarity) for stable absolute relevance thresholding
    const results = await index.query({
      data: query,
      topK: 100,
      includeMetadata: true,
      queryMode: QueryMode.DENSE,
    });

    console.log("Results:", results);
    // Filter results using Cosine Similarity threshold for multilingual precision
    const data = results
      .filter((result) => result.score >= RELEVANCE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.metadata)
      .filter(Boolean) as unknown as PutBlobResult[];

    console.log("Relevant images found:", data);
    return { data, query };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return { error: message };
  }
};
