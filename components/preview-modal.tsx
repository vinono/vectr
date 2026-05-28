"use client";

import {
  ApertureIcon,
  CalendarIcon,
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FocusIcon,
  SlidersIcon,
  TimerIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteImage } from "@/app/actions/delete";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ExifData } from "@/lib/exif";
import { cn } from "@/lib/utils";

export type PreviewImageItem = {
  url: string;
  pathname: string;
  description?: string;
  exif?: ExifData;
};

type PreviewModalProps = {
  images: PreviewImageItem[];
  activeIndex: number | null;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
};

type ExifItemType = {
  type: "camera" | "aperture" | "shutter" | "iso" | "focal" | "taken";
  value: string;
};

const CAROUSEL_TRANSITION_MS = 150;
const MODAL_CLOSE_MS = 200;

// Top level helper to format EXIF items and completely avoid cognitive complexity limits
const getExifItems = (exif?: ExifData): ExifItemType[] => {
  if (!exif) {
    return [];
  }
  const cameraAndLens = [exif.camera, exif.lens].filter(Boolean).join(" + ");
  const items: ExifItemType[] = [];
  if (cameraAndLens) {
    items.push({ type: "camera", value: cameraAndLens });
  }
  if (exif.aperture) {
    items.push({ type: "aperture", value: exif.aperture });
  }
  if (exif.shutterSpeed) {
    items.push({ type: "shutter", value: exif.shutterSpeed });
  }
  if (exif.iso) {
    items.push({ type: "iso", value: `ISO ${exif.iso}` });
  }
  if (exif.focalLength) {
    items.push({ type: "focal", value: exif.focalLength });
  }
  if (exif.takenAt) {
    items.push({ type: "taken", value: exif.takenAt });
  }
  return items;
};

export const PreviewModal = ({
  images,
  activeIndex,
  onClose,
  onChangeIndex,
}: PreviewModalProps) => {
  const isOpen = activeIndex !== null;
  const activeImage = activeIndex !== null ? images[activeIndex] : null;

  // Smooth slide/fade transition states
  const [displayedImage, setDisplayedImage] = useState<PreviewImageItem | null>(
    null
  );
  const [fadeClass, setFadeClass] = useState("opacity-100 scale-100 blur-0");
  const [isDeleting, setIsDeleting] = useState(false);

  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  // Sync displayed image with fade transition effect
  useEffect(() => {
    if (activeImage) {
      if (!displayedImage) {
        // Initial open: sync displayedImage with activeImage immediately
        setDisplayedImage(activeImage);
        setFadeClass("opacity-100 scale-100 blur-0");
      } else if (displayedImage.url !== activeImage.url) {
        // Smooth transition on left/right switching
        setFadeClass("opacity-0 scale-[0.98] blur-[2px]");
        const timer = setTimeout(() => {
          setDisplayedImage(activeImage);
          setFadeClass("opacity-100 scale-100 blur-0");
        }, CAROUSEL_TRANSITION_MS);
        return () => clearTimeout(timer);
      }
    } else if (displayedImage) {
      // Smooth fade-out on close (only if there is something currently displayed to fade out)
      setFadeClass("opacity-0 scale-[0.96] blur-[2px]");
      const timer = setTimeout(() => {
        setDisplayedImage(null);
      }, MODAL_CLOSE_MS);
      return () => clearTimeout(timer);
    }
  }, [activeImage, displayedImage]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (activeIndex !== null && thumbnailContainerRef.current) {
      const activeElement = thumbnailContainerRef.current.children[
        activeIndex
      ] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || images.length <= 1 || activeIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        const prevIndex = (activeIndex - 1 + images.length) % images.length;
        onChangeIndex(prevIndex);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        const nextIndex = (activeIndex + 1) % images.length;
        onChangeIndex(nextIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, activeIndex, images, onChangeIndex]);

  const targetImage = displayedImage || activeImage;

  // If there is no target image, render nothing
  if (!targetImage) {
    return null;
  }

  const caption = targetImage.description || "No description available yet.";
  const exif = targetImage.exif;

  const exifItems = getExifItems(exif);

  // Large premium edge-to-edge immersive full-screen popup sizing
  const dialogClassName =
    "fixed inset-0 z-50 w-screen h-screen !max-w-none !max-h-none border-none bg-black/85 p-0 shadow-none backdrop-blur-3xl transition-all duration-300 rounded-none overflow-hidden m-0 !left-0 !top-0 !translate-x-0 !translate-y-0 flex flex-col";

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!targetImage || isDeleting) {
      return;
    }

    // biome-ignore lint/suspicious/noAlert: Obtrusive prompt is intended here for simple secure admin confirmation
    const adminPassword = prompt(
      "请输入管理员密码以删除此图片 (Enter admin password to delete):"
    );
    if (adminPassword === null) {
      return;
    }

    if (!adminPassword.trim()) {
      toast.error("密码不能为空");
      return;
    }

    try {
      setIsDeleting(true);
      toast.loading("正在删除图片...", { id: "delete-image" });

      const res = await deleteImage(
        targetImage.pathname,
        targetImage.url,
        adminPassword
      );

      if (res.error) {
        toast.error(`删除失败: ${res.error}`, { id: "delete-image" });
      } else {
        toast.success("图片已成功删除", { id: "delete-image" });
        onClose();
        window.location.reload();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast.error(`删除出错: ${message}`, { id: "delete-image" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeIndex !== null) {
      const prevIndex = (activeIndex - 1 + images.length) % images.length;
      onChangeIndex(prevIndex);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeIndex !== null) {
      const nextIndex = (activeIndex + 1) % images.length;
      onChangeIndex(nextIndex);
    }
  };

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DialogContent className={dialogClassName} showCloseButton={false}>
        <DialogTitle className="sr-only">Image preview</DialogTitle>

        {/* Dynamic Ambient Background Blur */}
        <div className="-z-10 pointer-events-none absolute inset-0 select-none overflow-hidden">
          {/* biome-ignore lint/performance/noImgElement: Ambient blur requires raw img element */}
          {/* biome-ignore lint/nursery/useImageSize: Dynamic background sizing */}
          <img
            alt=""
            className={cn(
              "h-full w-full scale-125 transform-gpu object-cover opacity-40 blur-2xl brightness-[0.5] transition-all duration-500 will-change-[filter,transform]",
              fadeClass
            )}
            src={targetImage.url}
          />
          <div className="absolute inset-0 bg-black/45" />
        </div>

        <div className="relative flex h-full flex-col">
          {/* Floating Top controls bar (absolute) */}
          {/* Left Close */}
          <button
            aria-label="Close dialog"
            className="absolute top-6 left-6 z-50 flex size-11 cursor-pointer items-center justify-center rounded-full border border-white/5 bg-black/40 text-white/90 backdrop-blur-md transition-all hover:scale-105 hover:bg-black/60 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <XIcon className="size-5" />
          </button>

          {/* Right Action buttons */}
          <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
            <button
              aria-label="Delete image"
              className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-red-500/10 bg-red-950/40 text-red-200 backdrop-blur-md transition-all hover:scale-105 hover:bg-red-800/80 hover:text-white"
              onClick={handleDelete}
              type="button"
            >
              <Trash2Icon className="size-4.5" />
            </button>
            <a
              aria-label="View original image"
              className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-white/5 bg-black/40 text-white/90 backdrop-blur-md transition-all hover:scale-105 hover:bg-black/60 hover:text-white"
              href={targetImage.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon className="size-4.5" />
            </a>
            <a
              aria-label="Download image"
              className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-white/5 bg-black/40 text-white/90 backdrop-blur-md transition-all hover:scale-105 hover:bg-black/60 hover:text-white"
              download={caption || "download"}
              href={targetImage.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <DownloadIcon className="size-4.5" />
            </a>
          </div>

          <div className="group/container relative flex min-h-0 flex-1 items-center justify-center p-4">
            {/* biome-ignore lint/performance/noImgElement: Preview gallery lightbox uses raw img */}
            {/* biome-ignore lint/nursery/useImageSize: Raw aspect ratios computed dynamically */}
            <img
              alt={caption}
              className={cn(
                "max-h-[72vh] max-w-[92vw] transform rounded-lg object-contain shadow-2xl transition-all duration-300 ease-out",
                fadeClass
              )}
              src={targetImage.url}
            />

            {/* Navigation buttons overlay */}
            {images.length > 1 && (
              <>
                <button
                  aria-label="Previous image"
                  className="-translate-y-1/2 absolute top-1/2 left-8 flex size-12 cursor-pointer items-center justify-center rounded-full border border-white/5 bg-black/40 text-white opacity-85 shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-black/60 hover:opacity-100"
                  onClick={handlePrev}
                  type="button"
                >
                  <ChevronLeftIcon className="size-6" />
                </button>
                <button
                  aria-label="Next image"
                  className="-translate-y-1/2 absolute top-1/2 right-8 flex size-12 cursor-pointer items-center justify-center rounded-full border border-white/5 bg-black/40 text-white opacity-85 shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-black/60 hover:opacity-100"
                  onClick={handleNext}
                  type="button"
                >
                  <ChevronRightIcon className="size-6" />
                </button>
              </>
            )}

            {/* Caption & EXIF info floating overlay */}
            <div className="-translate-x-1/2 pointer-events-none absolute bottom-6 left-1/2 z-10 flex w-full max-w-2xl select-none flex-col items-center gap-2.5 px-6 text-center">
              {exifItems.length > 0 && (
                <div
                  className={cn(
                    "pointer-events-auto flex select-none flex-wrap items-center justify-center gap-x-5 gap-y-1.5 rounded-full border border-white/10 bg-black/60 px-4.5 py-1.5 font-mono text-[11px] text-zinc-200 tracking-wide shadow-xl backdrop-blur-md transition-all duration-300 ease-out",
                    fadeClass
                  )}
                >
                  {exifItems.map((item) => (
                    <span className="flex items-center gap-1.5" key={item.type}>
                      {item.type === "camera" && (
                        <CameraIcon className="size-3.5 text-zinc-400" />
                      )}
                      {item.type === "aperture" && (
                        <ApertureIcon className="size-3.5 text-zinc-400" />
                      )}
                      {item.type === "shutter" && (
                        <TimerIcon className="size-3.5 text-zinc-400" />
                      )}
                      {item.type === "iso" && (
                        <SlidersIcon className="size-3.5 text-zinc-400" />
                      )}
                      {item.type === "focal" && (
                        <FocusIcon className="size-3.5 text-zinc-400" />
                      )}
                      {item.type === "taken" && (
                        <CalendarIcon className="size-3.5 text-zinc-400" />
                      )}
                      <span>{item.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Horizontal Thumbnails navigation carousel */}
          <div className="z-10 flex h-24 shrink-0 items-center justify-center border-white/5 border-t bg-black/50 px-6 py-4 backdrop-blur-lg">
            <div
              className="scrollbar-none flex max-w-full gap-3 overflow-x-auto py-1"
              ref={thumbnailContainerRef}
              style={{ scrollbarWidth: "none" }}
            >
              {images.map((img, idx) => (
                <button
                  className={cn(
                    "relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 shadow-md transition-all duration-300 ease-out",
                    idx === activeIndex
                      ? "scale-110 border-white shadow-xl ring-2 ring-white/20 brightness-100"
                      : "border-transparent opacity-40 brightness-75 hover:scale-105 hover:opacity-85 hover:brightness-90"
                  )}
                  key={`${img.url}-${idx}`}
                  onClick={() => onChangeIndex(idx)}
                  type="button"
                >
                  {/* biome-ignore lint/performance/noImgElement: Raw image for dynamic thumbnails */}
                  {/* biome-ignore lint/nursery/useImageSize: Thumbnail sizing managed via container */}
                  <img
                    alt={`Thumbnail ${idx}`}
                    className="size-full object-cover"
                    loading="lazy"
                    src={img.url}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
