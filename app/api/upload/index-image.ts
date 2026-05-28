/** biome-ignore-all lint/suspicious/noConsole: "Handy for debugging" */

import { Index } from "@upstash/vector";
import type { PutBlobResult } from "@vercel/blob";
import { FatalError, getStepMetadata, RetryableError } from "workflow";
import type { ExifData } from "@/lib/exif";

const MAX_RETRIES = 5;

const handleIndexingError = (
  error: unknown,
  attempt: number,
  stepId: string,
  stepStartedAt: Date
) => {
  const message = error instanceof Error ? error.message : "Unknown error";

  // Check for rate limiting
  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("quota")
  ) {
    throw new RetryableError(`Upstash rate limited: ${message}`, {
      retryAfter: "1m",
    });
  }

  // Check for network/connection errors
  if (
    message.includes("timeout") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("network")
  ) {
    throw new RetryableError(`Network error: ${message}`, {
      retryAfter: "30s",
    });
  }

  // Check for invalid data (fatal)
  if (message.includes("invalid") || message.includes("400")) {
    throw new FatalError(`[${stepId}] Invalid data for indexing: ${message}`);
  }

  // After max attempts for search indexing, give up
  if (attempt >= MAX_RETRIES) {
    throw new FatalError(
      `[${stepId}] Failed to index image after ${attempt} attempts as of ${stepStartedAt.toISOString()}: ${message}`
    );
  }

  // Otherwise, retry
  throw new Error(`Search indexing failed: ${message}`);
};

export const indexImage = async (
  blob: PutBlobResult,
  text: string,
  exif?: ExifData
) => {
  "use step";

  const { attempt, stepStartedAt, stepId } = getStepMetadata();

  console.log(
    `[${stepId}] Indexing image (attempt ${attempt})...`,
    blob.downloadUrl
  );

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

    // Store blob metadata in Upstash along with the description
    const result = await index.upsert({
      id: blob.pathname,
      data: text,
      metadata: { ...blob, description: text, exif },
    });

    console.log(
      `[${stepId}] Successfully indexed image at ${stepStartedAt.toISOString()}`
    );

    return result;
  } catch (error) {
    handleIndexingError(error, attempt, stepId, stepStartedAt);
  }
};

indexImage.maxRetries = MAX_RETRIES;
