"use server";

import { del } from "@vercel/blob";
import { Index } from "@upstash/vector";

export async function deleteImage(
  pathname: string,
  url: string,
  adminPassword?: string
) {
  if (!process.env.ADMIN_PASSWORD) {
    return { error: "Delete password is not configured" };
  }

  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return { error: "Invalid admin password" };
  }

  try {
    // 1. Delete from Upstash Vector Index
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

    // The vector ID matches blob.pathname
    await index.delete(pathname);
    console.log(`Successfully deleted vector ID: ${pathname}`);

    // 2. Delete from Vercel Blob Storage
    await del(url);
    console.log(`Successfully deleted blob URL: ${url}`);

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete image:", error);
    return { error: error?.message || "Failed to delete image" };
  }
}
