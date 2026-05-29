"use server";

import { Index } from "@upstash/vector";

/**
 * Verifies that the entered username and password match the online credentials.
 */
// biome-ignore lint/suspicious/useAwait: Next.js server actions must be async
export async function verifyAdminCredentials(username: string, password: string) {
  if (!process.env.ADMIN_PASSWORD) {
    return {
      success: false,
      error: "管理员服务未配置 (ADMIN_PASSWORD is not configured)",
    };
  }

  const expectedUsername = process.env.ADMIN_USERNAME || "admin";

  if (
    username === expectedUsername &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return { success: true };
  }

  return {
    success: false,
    error: "用户名或密码错误 (Invalid username or password)",
  };
}

/**
 * Securely retrieves the list of all images with metadata, EXIF, and descriptions.
 * Validates the admin credentials before serving data.
 */
export async function getAdminImages(username: string, password: string) {
  if (!process.env.ADMIN_PASSWORD) {
    return {
      success: false,
      error: "管理员服务未配置 (ADMIN_PASSWORD is not configured)",
    };
  }

  const expectedUsername = process.env.ADMIN_USERNAME || "admin";

  if (
    username !== expectedUsername ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return {
      success: false,
      error: "身份验证失败 (Authentication failed)",
    };
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

    // Fetch the list of up to 100 vectors
    const { vectors } = await index.range({
      cursor: "0",
      limit: 100,
      includeMetadata: true,
      includeData: true,
    });

    const images = vectors
      .map((doc) => {
        if (doc.metadata) {
          return {
            ...(doc.metadata as any),
            id: doc.id,
          };
        }
        return null;
      })
      .filter(Boolean);

    return { success: true, data: images };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error)?.message || "获取图片列表失败",
    };
  }
}
