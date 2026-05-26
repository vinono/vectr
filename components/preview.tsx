import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PreviewProps = {
  url: string;
  description?: string;
  priority?: boolean;
};

export const Preview = ({ url, description, priority }: PreviewProps) => (
  <Dialog>
    <DialogTrigger asChild>
      <button
        className="mb-4 block w-full cursor-zoom-in rounded-xl bg-card p-2 shadow-xl"
        type="button"
      >
        <Image
          alt={description || url}
          className="rounded-md"
          height={630}
          priority={priority}
          sizes="630px"
          src={url}
          width={630}
        />
      </button>
    </DialogTrigger>
    <DialogContent className="max-w-4xl border-none bg-black/90 p-4">
      <DialogTitle className="sr-only">Image preview</DialogTitle>
      <div className="flex flex-col items-center">
        <img
          alt={description || url}
          className="max-h-[80vh] max-w-full object-contain"
          src={url}
        />
        <DialogDescription className="mt-4 text-center text-sm text-white">
          {description || url}
        </DialogDescription>
      </div>
    </DialogContent>
  </Dialog>
);
