"use client";

import type { ListBlobResult, PutBlobResult } from "@vercel/blob";
import {
  ArrowLeftIcon,
  FileIcon,
  ImageIcon,
  ImageUpIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { search } from "@/app/actions/search";
import type { ExifData } from "@/lib/exif";
import { Preview } from "./preview";
import { type PreviewImageItem, PreviewModal } from "./preview-modal";
import { Button } from "./ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/empty";
import { Input } from "./ui/input";
import { useUploadedImages } from "./uploaded-images-provider";

type ResultsClientProps = {
  defaultData: ListBlobResult["blobs"];
};

type SearchBlob = PutBlobResult & {
  description?: string;
  exif?: ExifData;
};

const PRIORITY_COUNT = 12;

export const ResultsClient = ({ defaultData }: ResultsClientProps) => {
  const { images } = useUploadedImages();
  const [state, formAction, isPending] = useActionState(search, { data: [] });
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  useEffect(() => {
    if ("error" in state) {
      toast.error(state.error);
    }
  }, [state]);

  const reset = () => {
    window.location.reload();
  };

  const hasImages =
    images.length ||
    defaultData.length ||
    ("data" in state && state.data?.length);

  // Normalize all current images for global navigation inside the PreviewModal
  const searchOrDefaultImages =
    "data" in state && state.data?.length
      ? (state.data as SearchBlob[])
      : defaultData;

  const allImages: PreviewImageItem[] = [
    ...images.map((image) => ({
      url: image.url,
      description: image.pathname,
      exif: image.exif,
    })),
    ...searchOrDefaultImages.map((blob) => {
      const isSearch = "description" in blob;
      return {
        url: isSearch ? blob.url : blob.downloadUrl,
        description: isSearch
          ? blob.description
          : blob.pathname || blob.downloadUrl,
        exif: (blob as unknown as SearchBlob).exif,
      };
    }),
  ];

  return (
    <>
      {hasImages ? (
        <div className="gap-4 sm:columns-2 md:columns-3 lg:columns-2 xl:columns-3">
          {images.map((image, index) => (
            <Preview
              description={image.pathname}
              key={image.url}
              onClick={() => setActiveImageIndex(index)}
              priority={index < PRIORITY_COUNT}
              url={image.url}
            />
          ))}
          {"data" in state && state.data?.length
            ? (state.data as SearchBlob[]).map((blob, index) => (
                <Preview
                  description={blob.description}
                  key={blob.url}
                  onClick={() => setActiveImageIndex(images.length + index)}
                  priority={index < PRIORITY_COUNT}
                  url={blob.url}
                />
              ))
            : defaultData.map((blob, index) => (
                <Preview
                  key={blob.url}
                  onClick={() => setActiveImageIndex(images.length + index)}
                  priority={index < PRIORITY_COUNT}
                  url={blob.downloadUrl}
                />
              ))}
        </div>
      ) : (
        <Empty className="h-full min-h-[50vh] rounded-lg border">
          <EmptyHeader className="max-w-none">
            <div className="relative isolate mb-8 flex">
              <div className="-rotate-12 translate-x-2 translate-y-2 rounded-full border bg-background p-3 shadow-xs">
                <ImageIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="z-10 rounded-full border bg-background p-3 shadow-xs">
                <UploadIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="-translate-x-2 translate-y-2 rotate-12 rounded-full border bg-background p-3 shadow-xs">
                <FileIcon className="size-5 text-muted-foreground" />
              </div>
            </div>
            <EmptyTitle>No images found</EmptyTitle>
            <EmptyDescription>
              Upload some images with the{" "}
              <ImageUpIcon className="inline size-4" /> button below to get
              started!
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Global Preview Modal with Carousel Navigation */}
      <PreviewModal
        activeIndex={activeImageIndex}
        images={allImages}
        onChangeIndex={(index) => setActiveImageIndex(index)}
        onClose={() => setActiveImageIndex(null)}
      />

      <form
        action={formAction}
        className="-translate-x-1/2 fixed bottom-8 left-1/2 flex w-full max-w-sm items-center gap-1 rounded-full bg-background p-1 shadow-xl sm:max-w-lg lg:ml-[182px]"
      >
        {"data" in state && state.data.length > 0 && (
          <Button
            className="shrink-0 rounded-full"
            disabled={isPending}
            onClick={reset}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
        )}
        <Input
          className="w-full rounded-full border-none bg-secondary shadow-none outline-none"
          disabled={isPending || !hasImages}
          id="search"
          name="search"
          placeholder="Search by description"
          required
        />
        {isPending ? (
          <Button className="shrink-0" disabled size="icon" variant="ghost">
            <Loader2Icon className="size-4 animate-spin" />
          </Button>
        ) : (
          <Button
            asChild
            className="shrink-0 cursor-pointer rounded-full hover:bg-muted"
            size="icon"
            variant="ghost"
          >
            <Link aria-label="Upload page" href="/upload">
              <ImageUpIcon className="size-4" />
            </Link>
          </Button>
        )}
      </form>
    </>
  );
};
