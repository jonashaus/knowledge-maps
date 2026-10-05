"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle dark mode"
          onClick={() => setTheme(dark ? "light" : "dark")}
        >
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{dark ? "Light mode" : "Dark mode"}</TooltipContent>
    </Tooltip>
  );
}
