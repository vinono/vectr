"use server";

import { del } from "@vercel/blob";
import { Index } from "@upstash/vector";

export async function deleteImage(
  pathname: string,
  url: string,
  adminUsername?: string,
  adminPassword?: string
) {
  if (!process.env.ADMIN_PASSWORD) {
    return { error: "管理员密码未配置 (Delete credentials are not configured)" };
  }

  const expectedUsername = process.env.ADMIN_USERNAME || "admin";

  if (
    !adminUsername ||
    adminUsername !== expectedUsername ||
    !adminPassword ||
    adminPassword !== process.env.ADMIN_PASSWORD
  ) {
    return { error: "身份验证失败 (Authentication failed)" };
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

    // 2. Delete from Vercel Blob Storage (Soft-catch so dummy test URLs don't block index deletion)
    try {
      if (url && (url.includes("vercel-storage.com") || url.includes("public.blob"))) {
        await del(url);
        console.log(`Successfully deleted blob URL: ${url}`);
      } else {
        console.log(`Skipped storage deletion for non-Vercel Blob URL: ${url}`);
      }
    } catch (blobError: any) {
      console.warn(`Soft Warning: Vercel Blob deletion failed: ${blobError.message}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete image:", error);
    return { error: error?.message || "Failed to delete image" };
  }
}
