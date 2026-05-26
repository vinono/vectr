import { Search } from "@upstash/search";
import type { ListBlobResult } from "@vercel/blob";
import { ResultsClient } from "./results.client";

export const Results = async () => {
  if (
    !(
      process.env.UPSTASH_SEARCH_REST_URL &&
      process.env.UPSTASH_SEARCH_REST_TOKEN
    )
  ) {
    return <ResultsClient defaultData={[]} />;
  }

  try {
    const upstash = Search.fromEnv();
    const index = upstash.index("images");

    // Fetch up to 50 documents directly from the search index to get complete metadata (including EXIF and description)
    const { documents } = await index.range({ cursor: "0", limit: 50 });

    // Map each document to match results structure, preserving description and exif
    const defaultData = documents
      .map((doc) => doc.metadata)
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
