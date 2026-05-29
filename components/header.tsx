"use client";

import { CheckCircle2Icon, GitBranchIcon, SparklesIcon } from "lucide-react";
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
      {/* Title & Brand */}
      <div className="flex flex-col gap-4">
        {/* Click Egg on Logo Group */}
        <div 
          className="flex items-center gap-2 cursor-pointer select-none active:opacity-80 transition-opacity"
          onClick={handleLogoClick}
          title="点击5次开启秘密通道"
        >
          <SparklesIcon className="size-5 animate-pulse text-amber-500 dark:text-amber-400" />
          <h1 className="bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500 bg-clip-text font-bold text-transparent text-xl tracking-tight dark:from-white dark:via-zinc-200 dark:to-zinc-500">
            Vectr AI Search
          </h1>
        </div>
        <p className="text-balance text-muted-foreground text-sm leading-relaxed">
          A premium, AI-powered natural language image search hub. Automatically
          analyzes image contents to create deep semantic vector indexing.
        </p>
        <p className="rounded-lg border border-zinc-200/50 bg-zinc-100/60 p-2.5 font-medium text-xs text-zinc-600 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-300">
          💡{" "}
          <span className="font-bold text-zinc-950 dark:text-white">
            Try searching:
          </span>{" "}
          "water", "landscape", "dark colors" or describe any visual concept.
        </p>
      </div>

      {/* Technical Stack Checklist */}
      <div className="space-y-3">
        <div className="font-bold text-xs text-zinc-500 uppercase tracking-wider">
          技术支撑 & 架构
        </div>
        <ul className="flex flex-col gap-3 text-muted-foreground">
          <li className="flex gap-2">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500/80" />
            <p className="text-xs leading-relaxed">
              存储层：
              <a
                className="font-medium text-zinc-800 transition-colors hover:text-zinc-950 hover:underline dark:text-zinc-200 dark:hover:text-white"
                href="https://vercel.com/storage"
                rel="noopener noreferrer"
                target="_blank"
              >
                Vercel Blob Storage
              </a>
            </p>
          </li>
          <li className="flex gap-2">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500/80" />
            <p className="text-xs leading-relaxed">
              多模态 analysis：
              <a
                className="font-medium text-zinc-800 transition-colors hover:text-zinc-950 hover:underline dark:text-zinc-200 dark:hover:text-white"
                href="https://ai-sdk.dev/"
                rel="noopener noreferrer"
                target="_blank"
              >
                Gemini Vision AI (Vercel AI SDK)
              </a>
            </p>
          </li>
          <li className="flex gap-2">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500/80" />
            <p className="text-xs leading-relaxed">
              向量底座：
              <a
                className="font-medium text-zinc-800 transition-colors hover:text-zinc-950 hover:underline dark:text-zinc-200 dark:hover:text-white"
                href="https://upstash.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                Upstash Vector Search (Dense)
              </a>
            </p>
          </li>
          <li className="flex gap-2">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500/80" />
            <p className="text-xs leading-relaxed">
              可靠弹性：
              <a
                className="font-medium text-zinc-800 transition-colors hover:text-zinc-950 hover:underline dark:text-zinc-200 dark:hover:text-white"
                href="https://useworkflow.dev/"
                rel="noopener noreferrer"
                target="_blank"
              >
                Vercel Workflow (自动重试)
              </a>
            </p>
          </li>
        </ul>
      </div>

      {/* Source Code */}
      <div className="flex gap-2 border-zinc-200/50 border-t pt-6 dark:border-white/5">
        <Button
          asChild
          className="w-full rounded-xl border-zinc-200 transition-all duration-300 hover:bg-zinc-100 dark:border-white/10 dark:hover:bg-zinc-800"
          size="sm"
          variant="outline"
        >
          <a
            className="flex items-center justify-center gap-1 text-xs text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            href="https://github.com/vinono/vectr"
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitBranchIcon className="size-3.5" />
            源码
          </a>
        </Button>
      </div>
    </div>
  );
};
