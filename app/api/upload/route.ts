import { NextResponse } from "next/server";
import { FatalError } from "workflow";
import { start } from "workflow/api";
import type { ExifData } from "@/lib/exif";
import { processImage } from "./process-image";

export const POST = async (request: Request): Promise<NextResponse> => {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const adminUsername = formData.get("adminUsername");
    const adminPassword = formData.get("adminPassword");
    const exifValue = formData.get("exif");

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Upload credentials are not configured" },
        { status: 500 }
      );
    }

    const expectedUsername = process.env.ADMIN_USERNAME || "admin";

    if (
      typeof adminUsername !== "string" ||
      adminUsername !== expectedUsername ||
      typeof adminPassword !== "string" ||
      adminPassword !== process.env.ADMIN_PASSWORD
    ) {
      return NextResponse.json(
        { error: "身份验证失败 (Invalid username or password)" },
        { status: 401 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size (15MB limit for server uploads)
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 15MB limit for server uploads" },
        { status: 400 }
      );
    }

    // Convert File to serializable format for the workflow
    const arrayBuffer = await file.arrayBuffer();
    const exif =
      typeof exifValue === "string"
        ? (JSON.parse(exifValue) as ExifData)
        : undefined;
    const fileData = {
      buffer: arrayBuffer,
      exif,
      name: file.name,
      type: file.type,
      size: file.size,
    };

    // Start the workflow in the background
    const result = await start(processImage, [fileData]);

    return NextResponse.json({
      success: true,
      runId: result.runId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isFatal = error instanceof FatalError;

    return NextResponse.json(
      {
        error: message,
        fatal: isFatal,
      },
      { status: isFatal ? 400 : 500 }
    );
  }
};
