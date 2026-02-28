import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatMessageBubbleProps {
  message: string | React.ReactNode;
  isUser: boolean;
  timestamp?: number | Date;
  className?: string;
  minWidthPct?: number; // default 10
  maxWidthPct?: number; // default 75
  disableInitial?: boolean;
  indexDelay?: number;
}

export function ChatMessageBubble({
  message,
  isUser,
  timestamp,
  className,
  minWidthPct = 10,
  maxWidthPct = 75,
  disableInitial,
  indexDelay,
}: ChatMessageBubbleProps) {
  const time = React.useMemo(() => {
    if (!timestamp) return "";
    const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [timestamp]);

  return (
    <motion.div
      layout
      initial={disableInitial ? false : { opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50, scale: 0.8 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: disableInitial ? 0 : indexDelay ?? 0, layout: { duration: 0.2 } }}
      className={cn("flex w-full gap-3 group", isUser ? "justify-end" : "justify-start", className)}
      data-testid={`message-${isUser ? "user" : "ai"}`}
    >
      <div className={cn("flex w-full flex-col", isUser ? "items-end" : "items-start") }>
        <motion.div
          layout
          initial={disableInitial ? false : { scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut", layout: { duration: 0.2 } }}
          className={cn(
            "relative inline-block whitespace-pre-wrap break-words overflow-wrap-anywhere px-4 py-3 text-sm leading-relaxed shadow-sm max-w-full min-w-0",
            isUser ? "bg-primary font-medium text-white" : "bg-muted font-base text-foreground border border-border",
            // More pronounced speaking-side corner difference
            isUser ? "rounded-xl rounded-br-[4px]" : "rounded-xl rounded-bl-[4px]",
          )}
          style={{ maxWidth: `${maxWidthPct}%`, minWidth: `${minWidthPct}%` }}
          data-testid="text-message-content"
        >
          <div className="w-full max-w-full min-w-0 break-words overflow-wrap-anywhere">
            {message}
          </div>
        </motion.div>

        {timestamp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
            className={cn("mt-1 px-1 text-xs text-muted-foreground", isUser ? "text-right" : "text-left")}
            data-testid="text-timestamp"
          >
            {time}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
