"use client";

import { CheckCircle2Icon, ImageUpIcon } from "lucide-react";
import { DeployButton } from "./deploy";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const Header = () => {
  const router = useRouter();
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Hidden Easter Egg: Click Logo 5 times within 2 seconds to redirect to Admin
  const handleLogoClick = () => {
    const now = Date.now();
    
    // Reset click count to 1 if the gap between clicks is larger than 2 seconds
    if (now - lastClickTime > 2000) {
      setClickCount(1);
      setLastClickTime(now);
    } else {
      const nextCount = clickCount + 1;
      if (nextCount >= 5) {
        setClickCount(0);
        setLastClickTime(0);
        router.push("/admin");
      } else {
        setClickCount(nextCount);
        setLastClickTime(now);
      }
    }
  };

  // Keyboard shortcut: Option+A (Mac) or Alt+A (Windows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // e.key === "å" is the character generated when pressing Option+A on macOS
      if (e.altKey && (e.key === "a" || e.key === "A" || e.key === "å")) {
        e.preventDefault();
        router.push("/admin");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <div className="flex flex-col gap-8 sm:gap-12">
      <div className="flex flex-col gap-4">
        {/* Click Egg on Logo Group */}
        <div 
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={handleLogoClick}
        >
          <ImageUpIcon className="size-4" />
          <h1 className="font-semibold tracking-tight">vectr.store</h1>
        </div>
        <p className="text-balance text-muted-foreground">
          A free, open-source template for building natural language image search
          on the AI Cloud.
        </p>
        <p className="text-muted-foreground text-sm italic">
          Try searching for "water" or "desert".
        </p>
      </div>
      
      <ul className="flex flex-col gap-2 text-muted-foreground sm:gap-4">
        <li className="flex gap-2">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            Uploads images to{" "}
            <a
              className="underline"
              href="https://vercel.com/storage"
              rel="noopener noreferrer"
              target="_blank"
            >
              Vercel Blob Storage
            </a>
          </p>
        </li>
        <li className="flex gap-2">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            Generates descriptions using Google Gemini 2.5 Flash through the{" "}
            <a
              className="underline"
              href="https://ai-sdk.dev/"
              rel="noopener noreferrer"
              target="_blank"
            >
              AI SDK
            </a>
          </p>
        </li>
        <li className="flex gap-2">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            Indexes descriptions in{" "}
            <a
              className="underline"
              href="https://upstash.com/docs/search/overall/getstarted"
              rel="noopener noreferrer"
              target="_blank"
            >
              Upstash Vector Search
            </a>
          </p>
        </li>
        <li className="flex gap-2">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            Uses{" "}
            <a
              className="underline"
              href="https://useworkflow.dev/"
              rel="noopener noreferrer"
              target="_blank"
            >
              Vercel Workflow
            </a>{" "}
            for resilient processing
          </p>
        </li>
      </ul>
      
      <div className="flex gap-2">
        <DeployButton />
        <Button asChild size="sm" variant="outline">
          <a
            href="https://github.com/vinono/vectr"
            rel="noopener noreferrer"
            target="_blank"
          >
            Source code
          </a>
        </Button>
      </div>
    </div>
  );
};
