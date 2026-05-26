"use client";

import type { PutBlobResult } from "@vercel/blob";
import type { ExifData } from "@/lib/exif";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type UploadedImagesContextValue = {
  images: UploadedImage[];
  addImage: (image: UploadedImage) => void;
};

export type UploadedImage = PutBlobResult & {
  exif?: ExifData;
};

const UploadedImagesContext = createContext<
  UploadedImagesContextValue | undefined
>(undefined);

export const useUploadedImages = () => {
  const ctx = useContext(UploadedImagesContext);
  if (!ctx) {
    throw new Error(
      "useUploadedImages must be used within an UploadedImagesProvider"
    );
  }
  return ctx;
};

type UploadedImagesProviderProps = {
  children: ReactNode;
};

export const UploadedImagesProvider = ({
  children,
}: UploadedImagesProviderProps) => {
  const [images, setImages] = useState<UploadedImage[]>([]);

  const addImage = useCallback(
    (image: UploadedImage) => setImages((prev) => [image, ...prev]),
    []
  );

  const value = useMemo(() => ({ images, addImage }), [images, addImage]);

  return (
    <UploadedImagesContext.Provider value={value}>
      {children}
    </UploadedImagesContext.Provider>
  );
};
