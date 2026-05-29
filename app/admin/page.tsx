"use client";

import {
  ArrowLeftIcon,
  BrainCircuitIcon,
  CameraIcon,
  CloudUploadIcon,
  DatabaseIcon,
  LayersIcon,
  Loader2Icon,
  LogOutIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getAdminImages, verifyAdminCredentials } from "@/app/actions/admin";
import { deleteImage } from "@/app/actions/delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useUploadedImages } from "@/components/uploaded-images-provider";
import { type ExifData, readExif } from "@/lib/exif";
import { cn } from "@/lib/utils";

type UploadingFile = {
  id: string;
  file: File;
  thumbnailUrl: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  errorMsg?: string;
};

type AdminImageItem = {
  id?: string;
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType?: string;
  contentDisposition?: string;
  description?: string;
  exif?: ExifData;
};

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
): Promise<File> =>
  new Promise((resolve) => {
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

export default function AdminPage() {
  const { addImage } = useUploadedImages();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Images state
  const [imagesList, setImagesList] = useState<AdminImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Upload states
  const [selectedFiles, setSelectedFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Load all images for admin list
  const loadImages = useCallback(async (user: string, pwd: string) => {
    try {
      setIsLoadingImages(true);
      const res = await getAdminImages(user, pwd);
      if (res.success && res.data) {
        setImagesList(res.data as AdminImageItem[]);
      } else {
        toast.error(res.error || "获取图片列表失败");
      }
    } catch {
      toast.error("获取图片列表时发生未知错误");
    } finally {
      setIsLoadingImages(false);
    }
  }, []);

  const verifySavedCredentials = useCallback(
    async (user: string, pwd: string) => {
      try {
        setIsVerifying(true);
        const res = await verifyAdminCredentials(user, pwd);
        if (res.success) {
          setIsAuthenticated(true);
          loadImages(user, pwd);
        } else {
          localStorage.removeItem("vectr_admin_username");
          localStorage.removeItem("vectr_admin_password");
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsVerifying(false);
      }
    },
    [loadImages]
  );

  // Check authentication status on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem("vectr_admin_username");
    const savedPassword = localStorage.getItem("vectr_admin_password");
    if (savedUsername && savedPassword) {
      setAdminUsername(savedUsername);
      setAdminPassword(savedPassword);
      verifySavedCredentials(savedUsername, savedPassword);
    } else {
      setIsAuthenticated(false);
    }
  }, [verifySavedCredentials]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      toast.error("请输入用户名");
      return;
    }
    if (!passwordInput.trim()) {
      toast.error("请输入密码");
      return;
    }

    try {
      setIsVerifying(true);
      const res = await verifyAdminCredentials(usernameInput, passwordInput);
      if (res.success) {
        setAdminUsername(usernameInput);
        setAdminPassword(passwordInput);
        localStorage.setItem("vectr_admin_username", usernameInput);
        localStorage.setItem("vectr_admin_password", passwordInput);
        setIsAuthenticated(true);
        loadImages(usernameInput, passwordInput);
        toast.success("管理员登录成功！");
      } else {
        toast.error(res.error || "用户名或密码错误，请重试");
      }
    } catch {
      toast.error("登录时发生未知错误");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("vectr_admin_username");
    localStorage.removeItem("vectr_admin_password");
    setAdminUsername("");
    setAdminPassword("");
    setUsernameInput("");
    setPasswordInput("");
    setIsAuthenticated(false);
    setImagesList([]);
    toast.success("已成功注销登录");
  };

  // Image deletion handler
  const handleDeleteImage = (item: AdminImageItem) => {
    // biome-ignore lint/suspicious/noAlert: standard confirm prompt for simple secure deletion
    if (!confirm(`确认要删除此图片吗?\n文件名: ${item.pathname}`)) {
      return;
    }

    const deletePromise = async () => {
      const res = await deleteImage(item.id || item.pathname, item.url, adminUsername, adminPassword);
      if (res.error) {
        throw new Error(res.error);
      }
      // Update local state
      setImagesList((prev) =>
        prev.filter((img) => (img.id || img.pathname) !== (item.id || item.pathname))
      );
      return res;
    };

    toast.promise(deletePromise(), {
      loading: "正在删除图片及向量索引...",
      success: "图片已成功删除",
      error: (err) => `删除失败: ${err.message}`,
    });
  };

  // Drag and drop events
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
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("仅支持上传图片文件");
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
        errorMsg: isOversized ? "文件大小超出 15MB 限制" : undefined,
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
            ? { ...f, status: "error", errorMsg: "已取消上传" }
            : f
        )
      );
      toast.info("已取消当前批次的上传");
    }
  };

  const startUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("请先添加要上传的图片");
      return;
    }

    const filesToUpload = selectedFiles.filter((f) => f.status === "pending");
    if (filesToUpload.length === 0) {
      toast.info("没有等待上传的文件");
      return;
    }

    abortControllerRef.current = new AbortController();
    setIsUploading(true);

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential progress stages in single upload callback
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
        const compressedFile = await compressImage(uploadFile.file);

        // Optimistic addition
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
        formData.append("adminUsername", adminUsername);
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
          let errorMsg = "服务器上传失败";
          try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            const text = await response.text();
            errorMsg = text || `服务器错误 (${response.status})`;
          }
          throw new Error(errorMsg);
        }

        addImage(tempBlob);

        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "success", progress: 100 }
              : f
          )
        );
      } catch (error) {
        let errorMsg = "上传失败";
        if (error instanceof Error) {
          errorMsg = error.name === "AbortError" ? "上传已取消" : error.message;
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
    toast.success("当前批次图片处理完成！");
    loadImages(adminUsername, adminPassword); // Reload to show new files in dashboard
  };

  // Filter local images list by filename or description
  const filteredImages = imagesList.filter((img) => {
    const term = searchTerm.toLowerCase();
    return (
      img.pathname.toLowerCase().includes(term) ||
      !!img.description?.toLowerCase().includes(term)
    );
  });

  // ----------------------------------------------------
  // RENDER 1: Loading authentication status
  // ----------------------------------------------------
  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-50 text-zinc-900 transition-colors duration-300 dark:bg-zinc-950 dark:text-zinc-50">
        <Loader2Icon className="size-8 animate-spin text-amber-500 dark:text-amber-400" />
        <p className="mt-4 font-medium text-sm text-zinc-500 dark:text-zinc-400">
          正在加载安全环境...
        </p>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER 2: Password protection wall (Login Form)
  // ----------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 px-4 text-zinc-900 transition-colors duration-300 dark:bg-zinc-950 dark:text-zinc-50">
        {/* Decorative background glows */}
        <div className="-top-40 -left-40 absolute size-96 rounded-full bg-amber-500/5 blur-3xl dark:bg-primary/10" />
        <div className="-bottom-40 -right-40 absolute size-96 rounded-full bg-emerald-500/5 blur-3xl dark:bg-emerald-500/10" />

        <div className="w-full max-w-md space-y-6 rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-white/5 dark:bg-zinc-900/60">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-primary/10 dark:text-amber-400">
              <ShieldCheckIcon className="size-6" />
            </div>
            <h1 className="font-bold text-2xl text-zinc-900 tracking-tight dark:text-white">
              管理员验证
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-muted-foreground">
              管理与上传图片属于高权操作，请输入账号和密码进行登录。
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleLoginSubmit}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Input
                  autoFocus
                  className="h-11 border-zinc-200 bg-zinc-50/50 px-4 text-zinc-900 focus-visible:ring-1 focus-visible:ring-amber-500 dark:border-white/10 dark:bg-zinc-950 dark:text-white dark:focus-visible:ring-primary"
                  disabled={isVerifying}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="请输入管理员账号..."
                  type="text"
                  value={usernameInput}
                />
              </div>
              <div className="space-y-1.5">
                <Input
                  className="h-11 border-zinc-200 bg-zinc-50/50 px-4 text-zinc-900 focus-visible:ring-1 focus-visible:ring-amber-500 dark:border-white/10 dark:bg-zinc-950 dark:text-white dark:focus-visible:ring-primary"
                  disabled={isVerifying}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="请输入管理员密码..."
                  type="password"
                  value={passwordInput}
                />
              </div>
            </div>
            <Button
              className="h-11 w-full rounded-xl bg-zinc-900 font-medium text-white shadow-md transition-all hover:bg-zinc-800 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/95"
              disabled={isVerifying}
              type="submit"
            >
              {isVerifying ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  正在校验密码...
                </>
              ) : (
                "进入管理后台"
              )}
            </Button>
          </form>

          <div className="pt-2 text-center">
            <Link
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-muted-foreground dark:hover:text-foreground"
              href="/"
            >
              <ArrowLeftIcon className="size-4" />
              返回公共搜索主页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER 3: Full Admin Dashboard
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-50 pb-12 text-zinc-900 transition-colors duration-300 dark:bg-zinc-950 dark:text-zinc-50">
      {/* Top Admin Header Bar */}
      <header className="sticky top-0 z-40 border-zinc-200/60 border-b bg-white/80 backdrop-blur-md dark:border-white/5 dark:bg-zinc-900/30">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-primary/10 dark:text-amber-400">
              <ShieldCheckIcon className="size-5" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 font-bold text-lg text-zinc-900 tracking-tight dark:text-zinc-50">
                Vectr 管理后台
                <Badge
                  className="border-amber-500/20 bg-amber-500/5 px-1.5 py-0 text-[10px] text-amber-600 dark:border-primary/20 dark:bg-primary/5 dark:text-primary"
                  variant="outline"
                >
                  ADMIN
                </Badge>
              </h1>
              <p className="hidden text-xs text-zinc-500 sm:block dark:text-muted-foreground">
                一站式图片上传、视觉生成审计与数据销毁
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              asChild
              className="rounded-full border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
              size="sm"
              variant="outline"
            >
              <Link href="/">
                <ArrowLeftIcon className="mr-1.5 size-3.5" />
                搜索前台
              </Link>
            </Button>
            <Button
              className="rounded-full text-red-600 hover:bg-red-500/5 dark:text-red-400 dark:hover:bg-red-500/10"
              onClick={handleLogout}
              size="sm"
              variant="ghost"
            >
              <LogOutIcon className="mr-1.5 size-3.5" />
              注销登录
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-6 py-8">
        {/* Stats Row */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-sm backdrop-blur dark:border-white/5 dark:bg-zinc-900/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-semibold text-xs text-zinc-500 uppercase tracking-wider dark:text-muted-foreground">
                总收录图片数
              </CardTitle>
              <DatabaseIcon className="size-4 text-amber-500 dark:text-primary" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-zinc-900 dark:text-white">
                {imagesList.length} 张
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-muted-foreground">
                已索引的图像向量集
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-sm backdrop-blur dark:border-white/5 dark:bg-zinc-900/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-semibold text-xs text-zinc-500 uppercase tracking-wider dark:text-muted-foreground">
                存储系统 (Storage)
              </CardTitle>
              <LayersIcon className="size-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-emerald-600 text-xl dark:text-emerald-400">
                Vercel Blob
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-muted-foreground">
                正常运作
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-sm backdrop-blur dark:border-white/5 dark:bg-zinc-900/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-semibold text-xs text-zinc-500 uppercase tracking-wider dark:text-muted-foreground">
                向量索引 (Database)
              </CardTitle>
              <DatabaseIcon className="size-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-blue-600 text-xl dark:text-blue-400">
                Upstash Vector
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-muted-foreground">
                正常运作 (Dense mode)
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-sm backdrop-blur dark:border-white/5 dark:bg-zinc-900/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-semibold text-xs text-zinc-500 uppercase tracking-wider dark:text-muted-foreground">
                视觉分析引擎
              </CardTitle>
              <BrainCircuitIcon className="size-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-purple-600 text-xl dark:text-purple-400">
                Gemini Vision AI
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-muted-foreground">
                用于自动多模态描述
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Dashboard Content Grid */}
        <section className="grid items-start gap-8 lg:grid-cols-[380px_1fr]">
          {/* LEFT: Upload Center Panel */}
          <div className="space-y-6">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-bold text-lg text-zinc-900 tracking-tight dark:text-zinc-50">
                上传中心
              </h2>
              <p className="text-xs text-zinc-500 dark:text-muted-foreground">
                拖拽上传全新图片，系统会自动使用 Gemini 分析并生成语义索引。
              </p>
            </div>

            {/* Drag & Drop Box */}
            {/* biome-ignore lint/a11y/useSemanticElements: drag & drop zone role */}
            <div
              className={cn(
                "relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center shadow-xs backdrop-blur transition-all duration-300",
                isDragActive
                  ? "scale-[1.01] border-primary bg-primary/5"
                  : "border-zinc-200 bg-white/50 hover:border-zinc-300 hover:bg-zinc-100/30 dark:border-white/10 dark:bg-zinc-900/20 dark:hover:border-white/20 dark:hover:bg-zinc-900/30"
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

              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full border border-zinc-200 bg-zinc-100 p-3 shadow-xs dark:border-white/5 dark:bg-secondary/80">
                  <CloudUploadIcon className="size-6 text-zinc-500 dark:text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                    {isDragActive ? "将图片拖放到此" : "拖入图片文件"}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-muted-foreground">
                    或点击此处在电脑中选择
                  </p>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-muted-foreground/60">
                  支持 JPEG, PNG, WebP，单个不超过 15MB
                </p>
              </div>
            </div>

            {/* Upload Files Status Box */}
            {selectedFiles.length > 0 && (
              <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-zinc-950/80">
                <div className="flex items-center justify-between border-zinc-100 border-b pb-2 dark:border-white/5">
                  <div className="font-semibold text-xs text-zinc-500 dark:text-muted-foreground">
                    待处理队列 ({selectedFiles.length})
                  </div>
                  <div className="flex gap-2">
                    {selectedFiles.some((f) => f.status === "success") && (
                      <Button
                        className="h-6 px-2 text-[10px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        onClick={clearCompleted}
                        size="sm"
                        variant="ghost"
                      >
                        清除成功
                      </Button>
                    )}
                    {isUploading ? (
                      <Button
                        className="h-6 px-2 text-[10px]"
                        onClick={cancelUploads}
                        size="sm"
                        variant="destructive"
                      >
                        取消上传
                      </Button>
                    ) : (
                      <Button
                        className="h-6 bg-zinc-900 px-2 text-[10px] text-white hover:bg-zinc-800 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        disabled={
                          selectedFiles.filter((f) => f.status === "pending")
                            .length === 0
                        }
                        onClick={startUpload}
                        size="sm"
                      >
                        开始分析上传
                      </Button>
                    )}
                  </div>
                </div>

                <div className="scrollbar-thin flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
                  {selectedFiles.map((item) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-2 dark:border-white/5 dark:bg-zinc-900/30"
                      key={item.id}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {/* biome-ignore lint/performance/noImgElement: Raw image for dynamic thumbnails */}
                        {/* biome-ignore lint/nursery/useImageSize: Thumbnail sizing managed via container */}
                        <img
                          alt={item.file.name}
                          className="size-10 rounded border border-zinc-200 object-cover dark:border-white/10"
                          src={item.thumbnailUrl}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-xs text-zinc-800 dark:text-zinc-200">
                            {item.file.name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-muted-foreground">
                            {(item.file.size / BYTES_IN_MB).toFixed(2)} MB
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          {item.status === "pending" && (
                            <Badge
                              className="border-zinc-200 px-1 py-0 text-[10px] text-zinc-500 dark:border-white/10 dark:text-zinc-400"
                              variant="outline"
                            >
                              就绪
                            </Badge>
                          )}
                          {item.status === "uploading" && (
                            <div className="flex flex-col items-end gap-1">
                              <span className="flex items-center gap-1 font-medium text-[9px] text-amber-600 dark:text-primary">
                                <Loader2Icon className="size-2.5 animate-spin" />
                                上传并分析中
                              </span>
                              <Progress
                                className="h-1 w-16"
                                value={item.progress}
                              />
                            </div>
                          )}
                          {item.status === "success" && (
                            <Badge
                              className="border-emerald-500/20 bg-emerald-500/5 px-1 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                              variant="outline"
                            >
                              成功 ✅
                            </Badge>
                          )}
                          {item.status === "error" && (
                            <Badge
                              className="cursor-help border-red-500/20 bg-red-500/5 px-1 py-0 text-[10px] text-red-500 dark:text-red-400"
                              title={item.errorMsg || "上传失败"}
                              variant="outline"
                            >
                              失败 ❌
                            </Badge>
                          )}
                        </div>

                        {!isUploading && (
                          <button
                            className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white"
                            onClick={() => removeFile(item.id)}
                            type="button"
                          >
                            <XIcon className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Image Auditing & Administration Center */}
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-bold text-lg text-zinc-900 tracking-tight dark:text-zinc-50">
                  视觉图库审计与管理
                </h2>
                <p className="text-xs text-zinc-500 dark:text-muted-foreground">
                  查看线上所有收录的图片和 AI 描述。您可以查看大图或销毁数据。
                </p>
              </div>

              {/* Toolbar Actions */}
              <div className="flex items-center gap-2">
                <Button
                  className="size-9 rounded-xl border-zinc-200 bg-white text-zinc-500 shadow-xs hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-900/40 dark:text-muted-foreground dark:hover:text-white"
                  disabled={isLoadingImages}
                  onClick={() => loadImages(adminUsername, adminPassword)}
                  size="icon"
                  title="刷新列表"
                  variant="outline"
                >
                  <RefreshCwIcon
                    className={cn("size-4", isLoadingImages && "animate-spin")}
                  />
                </Button>
                <div className="relative">
                  <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-zinc-400 dark:text-muted-foreground" />
                  <Input
                    className="h-9 w-48 border-zinc-200 bg-white pl-9 text-sm text-zinc-900 focus-visible:ring-1 focus-visible:ring-amber-500 sm:w-64 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-50 dark:focus-visible:ring-primary"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="按描述或文件名搜索..."
                    value={searchTerm}
                  />
                </div>
              </div>
            </div>

            {/* Images Table / List */}
            {isLoadingImages && (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-12 dark:border-white/5 dark:bg-zinc-900/10">
                <Loader2Icon className="size-8 animate-spin text-amber-500 dark:text-primary" />
                <p className="mt-4 font-medium text-sm text-zinc-500 dark:text-muted-foreground">
                  正在调取线上向量库中所有图片...
                </p>
              </div>
            )}

            {!isLoadingImages && filteredImages.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md dark:border-white/5 dark:bg-zinc-900/20">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-zinc-200 border-b bg-zinc-50 font-semibold text-xs text-zinc-500 uppercase tracking-wider dark:border-white/5 dark:bg-zinc-900/40 dark:text-muted-foreground">
                        <th className="w-24 px-4 py-4 text-center">缩略图</th>
                        <th className="w-48 px-4 py-4">文件信息</th>
                        <th className="px-4 py-4">
                          AI 视觉生成描述 (Vision Description)
                        </th>
                        <th className="w-24 px-4 py-4 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                      {filteredImages.map((item) => (
                        <tr
                          className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                          key={item.pathname}
                        >
                          {/* Thumbnail */}
                          <td className="px-4 py-4 text-center align-top">
                            <a
                              className="relative inline-block overflow-hidden rounded-lg border border-zinc-200 transition-colors group-hover:border-zinc-300 dark:border-white/10 dark:group-hover:border-white/30"
                              href={item.url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {/* biome-ignore lint/performance/noImgElement: Raw image for dynamic thumbnails */}
                              {/* biome-ignore lint/nursery/useImageSize: Thumbnail sizing managed via container */}
                              <img
                                alt={item.pathname}
                                className="size-16 object-cover shadow-sm transition-transform duration-300 hover:scale-105"
                                src={item.downloadUrl || item.url}
                              />
                            </a>
                          </td>

                          {/* File info */}
                          <td className="space-y-1 px-4 py-4 align-top">
                            <div
                              className="max-w-[180px] truncate font-semibold text-xs text-zinc-800 dark:text-white"
                              title={item.pathname}
                            >
                              {item.pathname}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-muted-foreground">
                              {item.contentType || "未知格式"}
                            </div>
                            {item.exif && (
                              <div className="flex items-center gap-1 font-mono text-[9px] text-amber-600 dark:text-primary/70">
                                <CameraIcon className="size-2.5" />
                                <span>{item.exif.camera || "EXIF"}</span>
                              </div>
                            )}
                          </td>

                          {/* Description box */}
                          <td className="px-4 py-4 align-top">
                            <div className="scrollbar-thin max-h-24 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50 p-3 font-sans text-xs text-zinc-700 leading-relaxed dark:border-white/5 dark:bg-zinc-950/60 dark:text-zinc-300">
                              {item.description || (
                                <span className="text-zinc-400 italic dark:text-muted-foreground">
                                  暂无 AI 分析描述 (生成中或缺失)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action Button */}
                          <td className="px-4 py-4 text-center align-top">
                            <Button
                              className="mt-1 size-8 rounded-lg text-zinc-400 transition-all hover:bg-red-500/5 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                              onClick={() => handleDeleteImage(item)}
                              size="icon"
                              title="删除图片与索引"
                              variant="ghost"
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!isLoadingImages && filteredImages.length === 0 && (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-zinc-200 border-dashed bg-white p-12 text-center dark:border-white/5 dark:bg-zinc-900/10">
                <p className="font-semibold text-base text-zinc-400 dark:text-zinc-400">
                  未找到相关图片
                </p>
                <p className="mt-1 max-w-xs text-xs text-zinc-500 dark:text-muted-foreground">
                  {searchTerm
                    ? "尝试缩减搜索条件以进行图库过滤"
                    : "线上图库暂无任何图片。在左侧上传几张吧！"}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
