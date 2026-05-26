import { list } from "@vercel/blob";
import { ResultsClient } from "./results.client";

export const Results = async () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return <ResultsClient defaultData={[]} />;
  }

  const { blobs } = await list({ limit: 50 });

  return <ResultsClient defaultData={blobs} />;
};
