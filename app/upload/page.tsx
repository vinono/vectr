"use client";

import {
  ArrowLeftIcon,
  CloudUploadIcon,
  ImageUpIcon,
  Loader2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useUploadedImages } from "@/components/uploaded-images-provider";
import { readExif } from "@/lib/exif";
import { cn } from "@/lib/utils";

type UploadingFile = {
  id: string;
  file: File;
  thumbnailUrl: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  errorMsg?: string;
};

// constants to avoid linter magic numbers
const MAX_FILE_SIZE_BYTES = 15_728_640; // 15MB
const BYTES_IN_MB = 1_048_576; // 1024 * 1024
const BATCH_UPLOAD_SIZE = 5;

const calculateDimensions = (
  width: number,
  height: number,
  maxWidth: number
) => {
  if (width <= maxWidth && height <= maxWidth) {
    return { width, height };
  }
  if (width > height) {
    return {
      width: maxWidth,
      height: Math.round((height * maxWidth) / width),
    };
  }
  return {
    width: Math.round((width * maxWidth) / height),
    height: maxWidth,
  };
};

/**
 * Client-side high-quality Canvas image compression
 */
const compressImage = (
  file: File,
  maxWidth = 2048,
  quality = 0.8
): Promise<File> => {
  return new Promise((resolve) => {
    // Only compress standard images (JPEG, PNG, WebP)
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = calculateDimensions(
          img.width,
          img.height,
          maxWidth
        );
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Standardize output format
        const outputType =
          file.type === "image/webp" ? "image/webp" : "image/jpeg";

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export default function UploadPage() {
  const { addImage } = useUploadedImages();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [adminPassword, setAdminPassword] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const isDemo =
    typeof window !== "undefined" &&
    window.location.hostname.includes("vectr.store");

  // Load password from localStorage on mount
  useEffect(() => {
    const savedPassword = localStorage.getItem("vectr_upload_password");
    if (savedPassword) {
      setAdminPassword(savedPassword);
    }
  }, []);

  // Save password to localStorage on change
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pwd = e.target.value;
    setAdminPassword(pwd);
    localStorage.setItem("vectr_upload_password", pwd);
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToList(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToList(Array.from(e.target.files));
    }
  };

  const addFilesToList = (files: File[]) => {
    // Filter only images
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("Only image files are supported");
      return;
    }

    const newUploadingFiles: UploadingFile[] = imageFiles.map((file) => {
      const isOversized = file.size > MAX_FILE_SIZE_BYTES;
      return {
        id: `${file.name}-${file.size}-${Date.now()}`,
        file,
        thumbnailUrl: URL.createObjectURL(file),
        progress: 0,
        status: isOversized ? "error" : "pending",
        errorMsg: isOversized ? "File exceeds the 15MB limit" : undefined,
      };
    });

    setSelectedFiles((prev) => [...prev, ...newUploadingFiles]);
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.thumbnailUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearCompleted = () => {
    setSelectedFiles((prev) => {
      const remaining = prev.filter((f) => f.status !== "success");
      const completed = prev.filter((f) => f.status === "success");
      for (const f of completed) {
        URL.revokeObjectURL(f.thumbnailUrl);
      }
      return remaining;
    });
  };

  const cancelUploads = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsUploading(false);
      setSelectedFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? { ...f, status: "error", errorMsg: "Upload cancelled" }
            : f
        )
      );
      toast.info("Upload batch cancelled");
    }
  };

  const startUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please add some images to upload first");
      return;
    }

    const filesToUpload = selectedFiles.filter((f) => f.status === "pending");
    if (filesToUpload.length === 0) {
      toast.info("No pending files to upload");
      return;
    }

    if (isDemo) {
      toast.error("Uploads are disabled in demo mode");
      return;
    }

    if (!adminPassword) {
      toast.error("Please enter the upload password");
      return;
    }

    abortControllerRef.current = new AbortController();
    setIsUploading(true);

    // Upload helper function
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: upload logic runs sequential async stages for progressive progress state
    const uploadSingleFile = async (uploadFile: UploadingFile) => {
      setSelectedFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "uploading", progress: 10 }
            : f
        )
      );

      try {
        const exif = await readExif(uploadFile.file);

        // Perform extreme high-quality client-side compression to avoid Vercel timeouts/bloated storage
        const compressedFile = await compressImage(uploadFile.file);
        // biome-ignore lint/suspicious/noConsole: Log optimized file size metrics for user diagnostics
        console.log(
          `[COMPRESSION] Optimized image ${uploadFile.file.name}: ${(uploadFile.file.size / BYTES_IN_MB).toFixed(2)}MB -> ${(compressedFile.size / BYTES_IN_MB).toFixed(2)}MB`
        );

        // Optimistic addition to global state (similar to upload-button.tsx)
        const tempBlob = {
          url: uploadFile.thumbnailUrl,
          downloadUrl: uploadFile.thumbnailUrl,
          pathname: uploadFile.file.name,
          contentType: compressedFile.type,
          contentDisposition: `attachment; filename="${compressedFile.name}"`,
          exif,
        };

        const formData = new FormData();
        formData.append("file", compressedFile);
        formData.append("adminPassword", adminPassword);
        if (exif) {
          formData.append("exif", JSON.stringify(exif));
        }

        setSelectedFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: 40 } : f))
        );

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          let errorMsg = "Server upload failed";
          try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            const text = await response.text();
            errorMsg = text || `Server error (${response.status})`;
          }
          throw new Error(errorMsg);
        }

        // Add to global state so it shows up in Home gallery list
        addImage(tempBlob);

        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "success", progress: 100 }
              : f
          )
        );
      } catch (error) {
        let errorMsg = "Upload failed";
        if (error instanceof Error) {
          errorMsg =
            error.name === "AbortError" ? "Upload cancelled" : error.message;
        }

        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "error", errorMsg } : f
          )
        );
      }
    };

    // Run batch processing
    for (let i = 0; i < filesToUpload.length; i += BATCH_UPLOAD_SIZE) {
      if (abortControllerRef.current?.signal.aborted) {
        break;
      }
      const batch = filesToUpload.slice(i, i + BATCH_UPLOAD_SIZE);
      await Promise.all(batch.map(uploadSingleFile));
    }

    setIsUploading(false);
    abortControllerRef.current = null;
    toast.success("Batch upload finished processing!");
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 text-foreground">
      {/* Header and Back navigation */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            asChild
            className="rounded-full border border-white/5 bg-secondary/80 text-foreground hover:bg-secondary"
            size="icon"
            variant="ghost"
          >
            <Link aria-label="Go back to search" href="/">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-bold text-2xl tracking-tight">Upload Images</h1>
            <p className="text-muted-foreground text-sm">
              Drag, drop and batch upload photos with automatic vision tags.
            </p>
          </div>
        </div>

        {/* Saved Password manager card */}
        <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-zinc-900/50 p-2.5 shadow-sm backdrop-blur">
          <Input
            aria-label="Upload password"
            className="w-40 border-none bg-secondary text-sm shadow-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={isUploading}
            onChange={handlePasswordChange}
            placeholder="Upload password"
            type="password"
            value={adminPassword}
          />
        </div>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        className={cn(
          "relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 text-center backdrop-blur transition-all duration-300",
          isDragActive
            ? "scale-[1.01] border-primary bg-primary/5"
            : "border-white/10 bg-zinc-900/20 hover:border-white/20 hover:bg-zinc-900/30"
        )}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <input
          accept="image/*"
          className="hidden"
          multiple
          onChange={handleFileSelect}
          ref={fileInputRef}
          type="file"
        />

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full border border-white/5 bg-secondary/80 p-4 shadow-md">
            <CloudUploadIcon className="size-8 animate-pulse text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-lg">
              {isDragActive
                ? "Drop your images here!"
                : "Drag & drop your images here"}
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              or click here to browse files on your computer.
            </p>
          </div>
          <p className="text-muted-foreground/60 text-xs">
            Supports standard image formats (JPEG, PNG, WebP) up to 15MB each.
          </p>
        </div>
      </div>

      {/* Uploading / File List Panel */}
      {selectedFiles.length > 0 && (
        <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-950/50 p-6 shadow-xl backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-semibold">
              Selected Images ({selectedFiles.length})
            </div>
            <div className="flex gap-2">
              {selectedFiles.some((f) => f.status === "success") && (
                <Button
                  className="gap-2 rounded-full text-xs"
                  onClick={clearCompleted}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2Icon className="size-3.5" />
                  Clear Success
                </Button>
              )}
              {isUploading ? (
                <Button
                  className="gap-2 rounded-full text-xs"
                  onClick={cancelUploads}
                  size="sm"
                  variant="destructive"
                >
                  <XIcon className="size-3.5" />
                  Cancel Upload
                </Button>
              ) : (
                <Button
                  className="gap-2 rounded-full text-xs shadow-md"
                  disabled={
                    selectedFiles.filter((f) => f.status === "pending")
                      .length === 0
                  }
                  onClick={startUpload}
                  size="sm"
                >
                  <ImageUpIcon className="size-3.5" />
                  Start Uploading
                </Button>
              )}
            </div>
          </div>

          {/* Files grid layout */}
          <div className="flex max-h-[400px] flex-col gap-3 overflow-y-auto pr-1">
            {selectedFiles.map((item) => (
              <div
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-zinc-900/40 p-3"
                key={item.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    alt={item.file.name}
                    className="size-14 rounded-lg border border-white/10 object-cover"
                    src={item.thumbnailUrl}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm">
                      {item.file.name}
                    </div>
                    <div className="mt-0.5 text-muted-foreground text-xs">
                      {(item.file.size / BYTES_IN_MB).toFixed(2)} MB
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  {/* File Status & Progress */}
                  <div className="text-right">
                    {item.status === "pending" && (
                      <span className="rounded-full border border-white/5 bg-secondary/80 px-2 py-1 font-medium text-muted-foreground text-xs">
                        Ready
                      </span>
                    )}
                    {item.status === "uploading" && (
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="flex items-center gap-1 font-medium text-primary text-xs">
                          <Loader2Icon className="size-3 animate-spin" />
                          Uploading...
                        </span>
                        <Progress
                          className="h-1.5 w-24"
                          value={item.progress}
                        />
                      </div>
                    )}
                    {item.status === "success" && (
                      <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 font-medium text-green-500 text-xs">
                        Success ✅
                      </span>
                    )}
                    {item.status === "error" && (
                      <span
                        className="cursor-help rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 font-medium text-red-500 text-xs"
                        title={item.errorMsg || "Upload failed"}
                      >
                        Failed ❌
                      </span>
                    )}
                  </div>

                  {/* Remove file button */}
                  {!isUploading && (
                    <Button
                      className="size-8 rounded-full text-muted-foreground hover:bg-zinc-800 hover:text-foreground"
                      onClick={() => removeFile(item.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <XIcon className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
