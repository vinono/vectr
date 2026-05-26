export type ExifData = {
  camera?: string;
  lens?: string;
  takenAt?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
};

const TAGS: Record<number, keyof ExifData> = {
  0x010f: "camera",
  0x0110: "camera",
  0x829a: "shutterSpeed",
  0x829d: "aperture",
  0x8827: "iso",
  0x9003: "takenAt",
  0x920a: "focalLength",
  0xa434: "lens",
};

const readAscii = (view: DataView, offset: number, length: number) => {
  let value = "";
  for (let i = 0; i < length; i += 1) {
    const char = view.getUint8(offset + i);
    if (char === 0) {
      break;
    }
    value += String.fromCharCode(char);
  }
  return value.trim();
};

const readRational = (view: DataView, offset: number, littleEndian: boolean) => {
  const numerator = view.getUint32(offset, littleEndian);
  const denominator = view.getUint32(offset + 4, littleEndian);
  return denominator ? numerator / denominator : undefined;
};

const formatShutterSpeed = (value?: number) => {
  if (!value) {
    return undefined;
  }
  if (value >= 1) {
    return `${Number(value.toFixed(2))}s`;
  }
  return `1/${Math.round(1 / value)}s`;
};

const formatDate = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
  return normalized;
};

const readValue = (
  view: DataView,
  tiffOffset: number,
  entryOffset: number,
  littleEndian: boolean
) => {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const valueOffset = entryOffset + 8;
  const typeSize = type === 2 ? 1 : type === 3 ? 2 : type === 4 ? 4 : type === 5 ? 8 : 0;
  const byteLength = count * typeSize;
  const dataOffset =
    byteLength <= 4 ? valueOffset : tiffOffset + view.getUint32(valueOffset, littleEndian);

  if (type === 2) {
    return readAscii(view, dataOffset, count);
  }
  if (type === 3) {
    return view.getUint16(dataOffset, littleEndian);
  }
  if (type === 4) {
    return view.getUint32(dataOffset, littleEndian);
  }
  if (type === 5) {
    return readRational(view, dataOffset, littleEndian);
  }
};

const readIfd = (
  view: DataView,
  tiffOffset: number,
  ifdOffset: number,
  littleEndian: boolean,
  exif: ExifData
) => {
  const entries = view.getUint16(ifdOffset, littleEndian);
  let exifIfdOffset: number | undefined;

  for (let i = 0; i < entries; i += 1) {
    const entryOffset = ifdOffset + 2 + i * 12;
    const tag = view.getUint16(entryOffset, littleEndian);

    if (tag === 0x8769) {
      exifIfdOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
      continue;
    }

    const key = TAGS[tag];
    if (!key) {
      continue;
    }

    const value = readValue(view, tiffOffset, entryOffset, littleEndian);
    if (typeof value === "string") {
      exif[key] = key === "takenAt" ? formatDate(value) : value;
    } else if (typeof value === "number") {
      if (key === "aperture") {
        exif[key] = `f/${Number(value.toFixed(1))}`;
      } else if (key === "focalLength") {
        exif[key] = `${Number(value.toFixed(1))}mm`;
      } else if (key === "shutterSpeed") {
        exif[key] = formatShutterSpeed(value);
      } else {
        exif[key] = String(Math.round(value));
      }
    }
  }

  if (exifIfdOffset) {
    readIfd(view, tiffOffset, exifIfdOffset, littleEndian, exif);
  }
};

export const readExif = async (file: File): Promise<ExifData | undefined> => {
  if (!file.type.includes("jpeg") && !file.type.includes("tiff")) {
    return undefined;
  }

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  if (view.getUint16(0) !== 0xffd8) {
    return undefined;
  }

  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;

    if (marker === 0xffe1) {
      const length = view.getUint16(offset);
      const exifOffset = offset + 2;

      if (readAscii(view, exifOffset, 6) !== "Exif") {
        return undefined;
      }

      const tiffOffset = exifOffset + 6;
      const littleEndian = view.getUint16(tiffOffset) === 0x4949;
      const firstIfdOffset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);
      const exif: ExifData = {};

      readIfd(view, tiffOffset, firstIfdOffset, littleEndian, exif);

      return Object.values(exif).some(Boolean) ? exif : undefined;
    }

    offset += view.getUint16(offset);
  }

  return undefined;
};
