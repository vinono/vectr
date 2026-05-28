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

const normalizeImages = (
  isSearchActive: boolean,
  images: Array<{ url: string; pathname: string; exif?: ExifData }>,
  searchOrDefaultImages: Array<{
    url: string;
    downloadUrl: string;
    pathname: string;
    description?: string;
    exif?: ExifData;
  }>
): PreviewImageItem[] => [
  ...(isSearchActive
    ? []
    : images.map((image) => ({
        url: image.url,
        pathname: image.pathname,
        description: image.pathname,
        exif: image.exif,
      }))),
  ...searchOrDefaultImages.map((blob) => {
    const isSearch = "description" in blob;
    return {
      url: isSearch ? blob.url : blob.downloadUrl,
      pathname: blob.pathname,
      description: isSearch
        ? blob.description
        : blob.pathname || blob.downloadUrl,
      exif: (blob as unknown as SearchBlob).exif,
    };
  }),
];

export const ResultsClient = ({ defaultData }: ResultsClientProps) => {
  const { images } = useUploadedImages();
  const [state, formAction, isPending] = useActionState(search, {
    data: [],
    query: "",
  });
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  useEffect(() => {
    if ("error" in state) {
      toast.error(state.error);
    }
  }, [state]);

  const reset = () => {
    window.location.reload();
  };

  const isSearchActive = "query" in state && state.query !== "";

  const hasImages = isSearchActive
    ? state.data.length > 0
    : images.length > 0 || defaultData.length > 0;

  // Normalize all current images for global navigation inside the PreviewModal
  const searchOrDefaultImages = isSearchActive
    ? (state.data as SearchBlob[])
    : defaultData;

  const allImages = normalizeImages(
    isSearchActive,
    images,
    searchOrDefaultImages
  );

  return (
    <>
      {hasImages ? (
        <div className="gap-4 sm:columns-2 md:columns-3 lg:columns-2 xl:columns-3">
          {!isSearchActive &&
            images.map((image, index) => (
              <Preview
                description={image.pathname}
                key={image.url}
                onClick={() => setActiveImageIndex(index)}
                priority={index < PRIORITY_COUNT}
                url={image.url}
              />
            ))}
          {isSearchActive
            ? (state.data as SearchBlob[]).map((blob, index) => (
                <Preview
                  description={blob.description}
                  key={blob.url}
                  onClick={() => setActiveImageIndex(index)}
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
            {isSearchActive ? (
              <>
                <EmptyTitle>No matching images found</EmptyTitle>
                <EmptyDescription>
                  No images matched the search term "{state.query}". Try
                  searching for something else!
                </EmptyDescription>
              </>
            ) : (
              <>
                <EmptyTitle>No images found</EmptyTitle>
                <EmptyDescription>
                  Upload some images with the{" "}
                  <ImageUpIcon className="inline size-4" /> button below to get
                  started!
                </EmptyDescription>
              </>
            )}
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
        {isSearchActive && (
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
          defaultValue={isSearchActive ? state.query : ""}
          disabled={isPending || !(hasImages || isSearchActive)}
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
