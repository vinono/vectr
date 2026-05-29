import { Index } from "@upstash/vector";
import type { ListBlobResult } from "@vercel/blob";
import { ResultsClient } from "./results.client";

export const Results = async () => {
  if (
    !(
      (process.env.UPSTASH_SEARCH_REST_URL ||
        process.env.UPSTASH_VECTOR_REST_URL) &&
      (process.env.UPSTASH_SEARCH_REST_TOKEN ||
        process.env.UPSTASH_VECTOR_REST_TOKEN)
    )
  ) {
    return <ResultsClient defaultData={[]} />;
  }

  try {
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

    // Fetch up to 50 documents directly from the search index to get complete metadata (including EXIF and description)
    const { vectors } = await index.range({
      cursor: "0",
      limit: 50,
      includeMetadata: true,
      includeData: true,
    });

    // Map each document to match results structure, preserving description and exif
    const defaultData = vectors
      .map((doc) => {
        if (doc.metadata) {
          return {
            ...(doc.metadata as any),
            id: doc.id,
          };
        }
        return null;
      })
      .filter(Boolean) as unknown as ListBlobResult["blobs"];

    return <ResultsClient defaultData={defaultData} />;
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: log initial data load failures to server console
    console.error(
      "Failed to load initial image list from search index:",
      error
    );
    // Fallback to empty list in case of network or configuration error
    return <ResultsClient defaultData={[]} />;
  }
};
