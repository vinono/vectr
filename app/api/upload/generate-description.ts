/** biome-ignore-all lint/suspicious/noConsole: "Handy for debugging" */

import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { PutBlobResult } from "@vercel/blob";
import { generateText, type ImagePart } from "ai";
import { FatalError, getStepMetadata, RetryableError } from "workflow";

const MAX_RETRIES = 5;

const getVisionModel = (stepId: string) => {
  const hasGemini =
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== "replace_with_your_gemini_api_key" &&
    process.env.GEMINI_API_KEY.trim() !== "";
  const hasOpenAI =
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== "replace_with_your_openai_api_key" &&
    process.env.OPENAI_API_KEY.trim() !== "";

  if (hasGemini) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
    return google("gemini-2.5-flash");
  }
  if (hasOpenAI) {
    return openai("gpt-4o-mini");
  }
  throw new FatalError(
    `[${stepId}] No AI provider API key configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in your environment variables.`
  );
};

export const generateDescription = async (blob: PutBlobResult) => {
  "use step";

  const { attempt, stepStartedAt, stepId } = getStepMetadata();

  console.log(
    `[${stepId}] Generating description (attempt ${attempt})...`,
    blob.downloadUrl
  );

  try {
    const imagePart: ImagePart = {
      type: "image",
      image: blob.downloadUrl,
      mediaType: blob.contentType,
    };

    const model = getVisionModel(stepId);
    console.log(`[${stepId}] Using AI model directly`);

    const { text } = await generateText({
      // biome-ignore lint/suspicious/noExplicitAny: Bypass SDK version mismatch
      model: model as any,
      system: "Describe the image in detail.",
      messages: [
        {
          role: "user",
          content: [imagePart],
        },
      ],
    });

    console.log(
      `[${stepId}] Successfully generated description at ${stepStartedAt.toISOString()}`
    );

    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Check for rate limiting or temporary errors
    if (
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("quota")
    ) {
      throw new RetryableError(`Rate limited: ${message}`, {
        retryAfter: "5m",
      });
    }

    // Check for invalid image or permanent errors
    if (
      message.includes("invalid image") ||
      message.includes("unsupported") ||
      message.includes("400")
    ) {
      throw new FatalError(
        `[${stepId}] Invalid image or unsupported format: ${message}`
      );
    }

    // After MAX_RETRIES attempts, give up
    if (attempt >= MAX_RETRIES) {
      throw new FatalError(
        `[${stepId}] Failed to generate description after ${attempt} attempts as of ${stepStartedAt.toISOString()}: ${message}`
      );
    }

    // Otherwise, retry with exponential backoff
    throw new Error(`AI generation failed: ${message}`);
  }
};

generateDescription.maxRetries = MAX_RETRIES;
