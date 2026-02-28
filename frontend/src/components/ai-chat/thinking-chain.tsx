import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ThinkingStep = {
  type: "thinking" | "tool_use" | "tool_result" | "status";
  content?: string;
  tool?: string;
  timestamp?: number;
  isComplete?: boolean;
  subagent_name?: string;
};

interface ThinkingChainProps {
  steps: ThinkingStep[];
  className?: string;
}

export const ThinkingChain: React.FC<ThinkingChainProps> = ({ steps, className }) => {
  if (steps.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "mb-3 w-full max-w-full rounded-lg border border-border bg-muted/30 backdrop-blur-sm overflow-hidden",
        className
      )}
    >
      <div className="px-4 py-3 w-full max-w-full min-w-0">
        {/* <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Processing
        </div> */}
        <div className="space-y-2 w-full max-w-full min-w-0">
          {steps.map((step, index) => (
            <StepItem key={index} step={step} />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const StepItem: React.FC<{ step: ThinkingStep }> = ({ step }) => {
  if (step.type === "thinking") {
    return (
      <div className="flex gap-2 w-full max-w-full min-w-0">
        <div className="mt-1 flex-shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-info" />
        </div>
        <div className="flex-1 min-w-0">
          {step.subagent_name && (
            <div className="mb-1 text-xs font-semibold text-info break-words">
              [{step.subagent_name}]
            </div>
          )}
          <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere">
            {step.content}
          </div>
        </div>
      </div>
    );
  }

  if (step.type === "tool_use") {
    // Format tool name from snake_case to Title Case
    const formatName = (name: string) => {
      return name
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };

    const toolName = step.tool || "Tool execution";
    const displayToolName = formatName(toolName.replace(/^mcp__/g, "").replace(/__/g, "_"));

    // Parse and format the args
    let formattedArgs: React.ReactNode = null;
    if (step.content) {
      try {
        const args = typeof step.content === "string" ? JSON.parse(step.content) : step.content;
        formattedArgs = (
          <div className="mt-2 w-full max-w-full min-w-0 rounded-md border border-border overflow-hidden text-xs">
            {/* Colored top bar with tool name */}
            <div className="px-2.5 py-1.5 font-semibold text-success-foreground text-xs bg-success border-b border-border break-words overflow-wrap-anywhere">
              {displayToolName}
            </div>
            {/* Args content */}
            <div className="p-2.5 bg-muted max-h-96 overflow-y-auto rb-scroll-thin w-full max-w-full min-w-0">
              {Object.entries(args).map(([key, value]) => {
                // Convert snake_case to Title Case
                const displayKey = formatName(key);

                // Format value - if it's a string that looks like snake_case, format it too
                let displayValue: string;
                if (typeof value === "string") {
                  // Check if it looks like a snake_case identifier (only lowercase, numbers, underscores)
                  if (/^[a-z0-9_]+$/.test(value) && value.includes("_")) {
                    displayValue = formatName(value);
                  } else {
                    displayValue = value;
                  }
                } else {
                  displayValue = JSON.stringify(value, null, 2);
                }

                return (
                  <div key={key} className="mb-2 last:mb-0 w-full max-w-full min-w-0">
                    <div className="font-semibold text-foreground mb-0.5 break-words overflow-wrap-anywhere">{displayKey}:</div>
                    <div className="text-muted-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere pl-2 min-w-0">
                      {displayValue}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      } catch (e) {
        // Fallback to raw content
        formattedArgs = (
          <div className="mt-2 w-full max-w-full min-w-0 rounded-md border border-border overflow-hidden text-xs">
            <div className="px-2.5 py-1.5 font-semibold text-success-foreground text-xs bg-success border-b border-border break-words overflow-wrap-anywhere">
              {displayToolName}
            </div>
            <div className="p-2.5 bg-muted text-muted-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere font-mono max-h-96 overflow-y-auto rb-scroll-thin w-full max-w-full min-w-0">
              {step.content}
            </div>
          </div>
        );
      }
    }

    return (
      <div className="w-full max-w-full min-w-0">
        {formattedArgs}
      </div>
    );
  }

  if (step.type === "tool_result") {
    return (
      <div className="flex gap-2 w-full max-w-full min-w-0">
        <div className="mt-1 flex-shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-success" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-success break-words overflow-wrap-anywhere">Result</div>
          {step.content && (
            <div className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere font-mono max-h-40 overflow-y-auto rb-scroll-thin min-w-0">
              {step.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step.type === "status") {
    return (
      <div className="flex gap-2 w-full max-w-full min-w-0">
        <div className="mt-1 flex-shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        </div>
        <div className="flex-1 min-w-0 text-sm italic text-muted-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere">
          {step.content}
        </div>
      </div>
    );
  }

  return null;
};
