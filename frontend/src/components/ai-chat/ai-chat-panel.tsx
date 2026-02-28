import React from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import { PromptInputBox } from "@/components/ai-chat/ai-prompt-box";
import { cn } from "@/lib/utils";
import { ChatMessageBubble } from "@/components/ai-chat/chat-message-bubble";
import { ThinkingChain } from "@/components/ai-chat/thinking-chain";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { CircleStop } from 'lucide-react';

import api from "@/lib/api";
import type {
  ChatRequest,
  ChatEvent,
  ChatContent,
  ChatContentPart,
} from "@/types/chat";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: ChatContent;
  createdAt: number;
  thinkingSteps?: ThinkingStep[];
};

const renderChatContent = (content: ChatContent): React.ReactNode => {
  if (Array.isArray(content)) {
    const parts = content as ChatContentPart[];
    return (
      <div className="flex flex-col gap-3 w-full max-w-full min-w-0">
        {parts.map((part, idx) => {
          if (part.type === "text") {
            return (
              <span key={idx} className="whitespace-pre-wrap break-words overflow-wrap-anywhere min-w-0">
                {part.text}
              </span>
            );
          }
          if (part.type === "image_url" && part.image_url?.url) {
            const url = part.image_url.url;
            return (
              <img
                key={idx}
                src={url}
                alt={`Uploaded image ${idx + 1}`}
                className="max-h-64 w-full max-w-full rounded-lg object-cover"
              />
            );
          }
          return null;
        })}
      </div>
    );
  }
  return content;
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Unsupported file result type."));
      }
    };
    reader.readAsDataURL(file);
  });
};

const fileToBase64 = async (file: File): Promise<{ data: string; filename: string; media_type: string }> => {
  const dataUrl = await fileToDataUrl(file);
  return {
    data: dataUrl, // Keep full data URL format
    filename: file.name,
    media_type: file.type || "application/octet-stream"
  };
};

interface AIChatPanelProps {
  onSend?: (message: string, files?: File[]) => void;
  className?: string;
  onEvents?: (events: ChatEvent[]) => void;
  style?: React.CSSProperties;
  conversationId?: string;
  modType?: string;
  placeholder?: string;
  useV2?: boolean;  // Use V2 multi-agent system
}

// A panel with a sticky input and scrollable history above it.
type ThinkingStep = {
  type: "thinking" | "tool_use" | "tool_result" | "status";
  content?: string;
  tool?: string;
  timestamp?: number;
  isComplete?: boolean;
  subagent_name?: string;
};

type QueuedMessage = {
  id: string;
  text: string;
  files?: File[];
  createdAt: number;
};

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ onSend, className, onEvents, style, conversationId, modType = "html", placeholder, useV2 = false }) => {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [assistantTyping, setAssistantTyping] = React.useState(false);
  const [thinkingSteps, setThinkingSteps] = React.useState<ThinkingStep[]>([]);
  const [messageQueue, setMessageQueue] = React.useState<QueuedMessage[]>([]);
  const [expandedThinking, setExpandedThinking] = React.useState<Set<string>>(new Set());
  // No default system prompt; user can set one via the toggle UI
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [isMobile, setIsMobile] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const lastSentMessageRef = React.useRef<{text: string; timestamp: number} | null>(null);
  const autoSendScheduledRef = React.useRef<boolean>(false);
  const autoSendTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentThinkingStepsRef = React.useRef<ThinkingStep[]>([]);

  React.useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 768px)");
    const update = () => setIsMobile(!!mq?.matches);
    update();
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);

  // No debug logs

  const handleSendInternal = async (message: string, files?: File[]) => {
    const timestamp = new Date().toISOString().split('T')[1];
    console.log(`[${timestamp}] 🔵 handleSendInternal CALLED:`, message);
    console.log(`[${timestamp}] 🔵 assistantTyping:`, assistantTyping);
    console.log(`[${timestamp}] 🔵 current queue length:`, messageQueue.length);

    // IMMEDIATELY set typing to true to prevent race conditions with the effect
    setAssistantTyping(true);
    console.log(`[${timestamp}] 🔵 Set assistantTyping to TRUE immediately`);

    let text = message?.trim() || "";
    const imageFiles = Array.isArray(files) ? files.filter((file) => file.type.startsWith("image/")) : [];
    const otherFiles = Array.isArray(files) ? files.filter((file) => !file.type.startsWith("image/")) : [];
    let imageDataUrls: string[] = [];
    let shouldAutoSendNext = true; // Track if we should auto-send next message

    // Convert other files (CSV, PDF, DOCX, etc.) to base64 for sending to backend
    // Files are automatically saved to inputs directory - no need to embed content in message
    const fileDataArray: { data: string; filename: string; media_type: string }[] = [];
    if (otherFiles.length > 0) {
      // Convert all files to base64
      try {
        const fileDataPromises = otherFiles.map((file) => fileToBase64(file));
        const fileDataResults = await Promise.all(fileDataPromises);
        fileDataArray.push(...fileDataResults);
      } catch (err) {
        console.error("Failed to convert files to base64:", err);
      }
    }

    if (imageFiles.length > 0) {
      try {
        imageDataUrls = await Promise.all(imageFiles.map((file) => fileToDataUrl(file)));
      } catch (err) {
        console.error(err);
      }
    }

    const parts: ChatContentPart[] = [];
    if (text.length > 0) {
      parts.push({ type: "text", text });
    }
    imageDataUrls.forEach((url) => {
      parts.push({ type: "image_url", image_url: { url } });
    });

    let content: ChatContent = "";
    if (parts.length === 0) {
      content = "";
    } else if (parts.length === 1 && parts[0].type === "text") {
      content = parts[0].text || "";
    } else {
      content = parts;
    }

    const now = Date.now();
    const newMsg: ChatMessage = { id: uuidv4(), role: "user", content, createdAt: now };
    setMessages((prev) => [...prev, newMsg]);
    onSend?.(message, files);

    // Already set assistantTyping above
    setThinkingSteps([]); // Clear previous thinking steps
    const assistantId = uuidv4();
    let assistantText = "";
    let allEvents: ChatEvent[] = [];
    const currentToolUses = new Map<string, number>(); // Track tool usage by tool_use_id
    const recentToolResults = new Map<string, string>(); // Track recent tool results to filter duplicates
    let assistantMessageCreated = false; // Track if we've added the message bubble yet

    try {
      // Build full history (role/content); include system only if provided
      const base = [...messages, newMsg];
      const history = (
        systemPrompt && systemPrompt.trim().length > 0
          ? [{ role: 'system' as const, content: systemPrompt.trim() }, ...base]
          : base
      ).map(m => ({ role: m.role, content: m.content }));
      const payload: ChatRequest = {
        messages: history,
        conversation_id: conversationId,
        mod_type: modType,
        files: fileDataArray.length > 0 ? fileDataArray : undefined
      };

      // DON'T create empty assistant message yet - wait for actual content

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Stream events from backend (V1 or V2)
      const streamFunction = useV2 ? api.chat.streamWithMultiAgents : api.chat.streamWithSDK;
      for await (const event of streamFunction(payload, abortController.signal)) {
        if (event.type === "thinking") {
          // Add thinking step - NEVER truncate
          setThinkingSteps((prev) => {
            const newStep: ThinkingStep = {
              type: "thinking",
              content: event.content || "Thinking...",
              timestamp: Date.now(),
              subagent_name: event.subagent_name,
            };
            const newSteps = [...prev, newStep];
            currentThinkingStepsRef.current = newSteps;
            return newSteps;
          });
        } else if (event.type === "text") {
          // Safeguard: Never add content if this looks like it might be from a tool_result
          // (shouldn't happen, but protect against misclassified events)
          if (event.result || event.result_full) {
            // Skip - this looks like a tool_result masquerading as text
            continue;
          }
          
          // Additional safeguard: Check if text content matches recent tool results
          if (event.content) {
            const textContent = event.content.substring(0, 200); // Check first 200 chars
            let isToolResultDuplicate = false;
            
            // Check if this text matches any recent tool result
            for (const [, toolResult] of recentToolResults.entries()) {
              if (textContent.includes(toolResult) || toolResult.includes(textContent)) {
                // This text appears to be duplicate of a tool result
                isToolResultDuplicate = true;
                break;
              }
            }
            
            // Also check for common tool result patterns
            if (!isToolResultDuplicate) {
              // Check for command-message, command-name tags (from Skill tool)
              if (event.content.includes('<command-message>') || 
                  event.content.includes('<command-name>') ||
                  event.content.includes('Base directory for this skill:')) {
                isToolResultDuplicate = true;
              }
            }
            
            if (isToolResultDuplicate) {
              // Skip adding this text - it's likely a tool result that leaked into text
              continue;
            }
          }
          
          // Create message bubble on first text (not before)
          if (!assistantMessageCreated) {
            const assistantMsg: ChatMessage = {
              id: assistantId,
              role: "assistant",
              content: "",
              createdAt: Date.now()
            };
            setMessages((prev) => [...prev, assistantMsg]);
            assistantMessageCreated = true;
          }

          // Append text as it arrives (only if content exists and passed all checks)
          if (event.content) {
            assistantText += event.content;
            setMessages((prev) => prev.map(m =>
              m.id === assistantId ? { ...m, content: assistantText } : m
            ));
          }
        } else if (event.type === "tool_use") {
          // Add tool use step
          const toolName = event.tool === "Task"
            ? `${event.args?.description || 'Running task'}`
            : event.tool || "unknown";

          setThinkingSteps((prev) => {
            const newSteps = [...prev];
            const stepIndex = newSteps.length;
            currentToolUses.set(event.tool_use_id || event.tool || "", stepIndex);

            const newStep: ThinkingStep = {
              type: "tool_use",
              tool: toolName,
              content: event.args_json, // Don't truncate tool args
              timestamp: Date.now(),
              isComplete: false,
            };
            const updatedSteps = [...newSteps, newStep];
            currentThinkingStepsRef.current = updatedSteps;
            return updatedSteps;
          });
        } else if (event.type === "tool_result") {
          // Store tool result to filter duplicates in text events
          const resultContent = event.result_full || event.result || "";
          if (resultContent && event.tool_use_id) {
            // Store first 200 chars for comparison (to avoid memory issues with large results)
            recentToolResults.set(event.tool_use_id, resultContent.substring(0, 200));
            // Clean up old entries (keep last 10)
            if (recentToolResults.size > 10) {
              const firstKey = recentToolResults.keys().next().value;
              if (firstKey) {
                recentToolResults.delete(firstKey);
              }
            }
          }
          
          // Mark tool as complete and add result
          const toolIndex = currentToolUses.get(event.tool_use_id || "");
          if (toolIndex !== undefined) {
            setThinkingSteps((prev) => {
              const newSteps = [...prev];
              if (newSteps[toolIndex]) {
                newSteps[toolIndex] = { ...newSteps[toolIndex], isComplete: true };
              }
              // Add result as a new step
              const newStep: ThinkingStep = {
                type: "tool_result",
                content: resultContent,
                timestamp: Date.now(),
                isComplete: true,
              };
              const updatedSteps = [...newSteps, newStep];
              currentThinkingStepsRef.current = updatedSteps;
              return updatedSteps;
            });
          }
        } else if (event.type === "status") {
          // Add status step
          if (!event.message?.includes("Processing message") && !event.message?.includes("System:")) {
            setThinkingSteps((prev) => {
              const newStep: ThinkingStep = {
                type: "status",
                content: event.message,
                timestamp: Date.now(),
              };
              const newSteps = [...prev, newStep];
              currentThinkingStepsRef.current = newSteps;
              return newSteps;
            });
          }
        } else if (event.type === "done") {
          // Final content and events
          // Safeguard: Never use content from tool_result events
          if (event.content && !event.result && !event.result_full) {
            assistantText = event.content || assistantText;
          }
          allEvents = event.events || [];

          // Capture thinking steps from ref (has the most current value)
          const capturedThinkingSteps = currentThinkingStepsRef.current.length > 0 ? [...currentThinkingStepsRef.current] : undefined;

          // Create message bubble if we haven't yet (edge case: no text events)
          if (!assistantMessageCreated && assistantText) {
            const assistantMsg: ChatMessage = {
              id: assistantId,
              role: "assistant",
              content: assistantText,
              createdAt: Date.now(),
              thinkingSteps: capturedThinkingSteps
            };
            setMessages((prev) => [...prev, assistantMsg]);
            assistantMessageCreated = true;
          } else if (assistantMessageCreated) {
            // Update existing message with final content and thinking steps
            setMessages((prev) => prev.map(m =>
              m.id === assistantId ? { ...m, content: assistantText, thinkingSteps: capturedThinkingSteps } : m
            ));
          }

          // Clear active thinking steps after storing them
          setTimeout(() => {
            setThinkingSteps([]);
            currentThinkingStepsRef.current = [];
          }, 1000);

          if (allEvents.length > 0) {
            onEvents?.(allEvents);
          }
          break;
        } else if (event.type === "error") {
          assistantText = `Error: ${event.error}`;

          // Create error message bubble if needed
          if (!assistantMessageCreated) {
            const assistantMsg: ChatMessage = {
              id: assistantId,
              role: "assistant",
              content: assistantText,
              createdAt: Date.now()
            };
            setMessages((prev) => [...prev, assistantMsg]);
            assistantMessageCreated = true;
          } else {
            setMessages((prev) => prev.map(m =>
              m.id === assistantId ? { ...m, content: assistantText } : m
            ));
          }

          setThinkingSteps([]);
          break;
        }
      }
    } catch (err: unknown) {
      // Check if this is an error we should handle silently
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ ERROR IN handleSendInternal:', errorMessage);

      const isAbortError = err instanceof Error && (err.name === 'AbortError' || errorMessage.includes('aborted'));
      const isTransportError = errorMessage.toLowerCase().includes('transport') ||
                               errorMessage.toLowerCase().includes('not ready') ||
                               errorMessage.toLowerCase().includes('writing');

      console.log('❌ isAbortError:', isAbortError);
      console.log('❌ isTransportError:', isTransportError);

      // Don't auto-send next message if there was an error
      shouldAutoSendNext = false;

      // Don't clear queue - let user manage it with Stop button or force-send
      console.log(`[${timestamp}] ⚠️ Error occurred but preserving queue`);

      if (isAbortError || isTransportError) {
        const ts = new Date().toISOString().split('T')[1];
        console.log(`[${ts}] 🔕 Silently handling error (no UI message):`, errorMessage);
        setThinkingSteps([]);
      } else {
        const ts = new Date().toISOString().split('T')[1];
        console.log(`[${ts}] 🔔 Showing error to user:`, errorMessage);
        // Real error - show to user
        const errorContent = `Error: ${errorMessage}`;

        // Create error message bubble if needed
        if (!assistantMessageCreated) {
          const assistantMsg: ChatMessage = {
            id: assistantId,
            role: "assistant",
            content: errorContent,
            createdAt: Date.now()
          };
          setMessages((prev) => [...prev, assistantMsg]);
        } else {
          setMessages((prev) => prev.map(m =>
            m.id === assistantId ? { ...m, content: errorContent } : m
          ));
        }

        setThinkingSteps([]);
      }
    } finally {
      const timestamp = new Date().toISOString().split('T')[1];
      console.log(`[${timestamp}] 🏁 FINALLY BLOCK - shouldAutoSendNext:`, shouldAutoSendNext);
      setAssistantTyping(false);
      console.log(`[${timestamp}] 🏁 Set assistantTyping to FALSE`);
      abortControllerRef.current = null;

      // Don't clear queue here - errors don't affect queued messages
      // Queue is only cleared by manual Stop button (via handleStop(true))
    }
  };

  // Effect to auto-send queued messages when agent finishes
  React.useEffect(() => {
    const timestamp = new Date().toISOString().split('T')[1];
    console.log(`[${timestamp}] 🔄 Effect triggered - assistantTyping:`, assistantTyping, 'queue length:', messageQueue.length, 'scheduled:', autoSendScheduledRef.current);

    // Only process queue when agent becomes idle and queue is not empty
    if (!assistantTyping && messageQueue.length > 0 && !autoSendScheduledRef.current) {
      console.log(`[${timestamp}] 📤 Agent finished, processing queue...`);
      autoSendScheduledRef.current = true;

      // Wait for SDK to be ready, then send first queued message
      const timeoutId = setTimeout(() => {
        const ts = new Date().toISOString().split('T')[1];
        console.log(`[${ts}] ⏰ Auto-send timeout fired`);

        setMessageQueue((currentQueue) => {
          if (currentQueue.length > 0) {
            const nextMessage = currentQueue[0];
            console.log(`[${ts}] 📨 Sending queued message:`, nextMessage.text);

            // Reset flag and send
            autoSendScheduledRef.current = false;
            autoSendTimeoutRef.current = null;
            handleSendInternal(nextMessage.text, nextMessage.files);

            // Remove from queue
            return currentQueue.slice(1);
          } else {
            console.log(`[${ts}] ⚠️ Queue empty when timeout fired`);
            autoSendScheduledRef.current = false;
            autoSendTimeoutRef.current = null;
            return currentQueue;
          }
        });
      }, 1000);

      autoSendTimeoutRef.current = timeoutId;
      console.log(`[${timestamp}] ⏰ Scheduled auto-send timeout:`, timeoutId);
    }
  }, [assistantTyping]);

  const handleSend = async (message: string, files?: File[]) => {
    const timestamp = new Date().toISOString().split('T')[1];
    console.log(`[${timestamp}] 🟢 handleSend CALLED:`, message);
    console.log(`[${timestamp}] 🟢 assistantTyping:`, assistantTyping);

    // Cancel any pending auto-send when user manually sends
    if (autoSendTimeoutRef.current) {
      console.log(`[${timestamp}] 🚫 Canceling pending auto-send timeout:`, autoSendTimeoutRef.current);
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
      autoSendScheduledRef.current = false;
    }

    // Prevent duplicate sends (same message within 1 second)
    const now = Date.now();
    const trimmedMessage = message?.trim() || "";

    if (lastSentMessageRef.current &&
        lastSentMessageRef.current.text === trimmedMessage &&
        now - lastSentMessageRef.current.timestamp < 1000) {
      console.log(`[${timestamp}] 🚫 Prevented duplicate send:`, trimmedMessage);
      return;
    }

    // Record this send attempt
    lastSentMessageRef.current = { text: trimmedMessage, timestamp: now };

    // If agent is busy, add to queue instead of sending
    if (assistantTyping) {
      console.log(`[${timestamp}] 📥 Agent busy - adding to queue`);
      const queuedMsg: QueuedMessage = {
        id: uuidv4(),
        text: message,
        files,
        createdAt: Date.now()
      };
      setMessageQueue((prev) => {
        console.log(`[${timestamp}] 📥 Queue before:`, prev.length);
        const newQueue = [...prev, queuedMsg];
        console.log(`[${timestamp}] 📥 Queue after:`, newQueue.length);
        return newQueue;
      });
      return;
    }

    // Otherwise send immediately
    console.log(`[${timestamp}] 🚀 Agent not busy - sending immediately`);
    await handleSendInternal(message, files);
  };

  const handleStop = async (clearQueue: boolean = false) => {
    const timestamp = new Date().toISOString().split('T')[1];
    console.log(`[${timestamp}] 🛑 Stop called - clearQueue:`, clearQueue);

    // 0. Cancel any pending auto-send
    if (autoSendTimeoutRef.current) {
      console.log(`[${timestamp}] 🚫 Canceling auto-send timeout in handleStop`);
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
      autoSendScheduledRef.current = false;
    }

    // 1. Call backend interrupt endpoint
    try {
      await api.chat.interrupt(conversationId || 'default');
      console.log(`[${timestamp}] ✅ Backend interrupted`);
    } catch (err) {
      console.error(`[${timestamp}] Failed to interrupt backend:`, err);
    }

    // 2. Abort the fetch immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 3. Update UI state
    setAssistantTyping(false);
    setThinkingSteps([]);

    // 4. Clear queue if requested (only for manual stop button, not force-send)
    if (clearQueue) {
      console.log(`[${timestamp}] 🧹 Clearing queue (manual stop)`);
      setMessageQueue([]);
    }
  };

  const handleForceSend = async (queuedMessageId: string) => {
    const timestamp = new Date().toISOString().split('T')[1];
    console.log(`[${timestamp}] 🚀 Force send clicked for message:`, queuedMessageId);

    // Find the message in the queue
    const queuedMsg = messageQueue.find(m => m.id === queuedMessageId);
    if (!queuedMsg) {
      console.log(`[${timestamp}] ⚠️ Message not found in queue`);
      return;
    }

    console.log(`[${timestamp}] 📤 Force sending:`, queuedMsg.text);

    // Block auto-send effect during force-send
    autoSendScheduledRef.current = true;
    console.log(`[${timestamp}] 🔒 Blocking auto-send during force-send`);

    // Remove ONLY this message from queue (keep others)
    setMessageQueue((prev) => {
      const filtered = prev.filter(m => m.id !== queuedMessageId);
      console.log(`[${timestamp}] Queue before force-send:`, prev.length, '-> after:', filtered.length);
      return filtered;
    });

    // Stop current agent WITHOUT clearing queue
    await handleStop(false);

    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 200));

    // Send this message immediately
    console.log(`[${timestamp}] 📨 Sending force-sent message now`);
    autoSendScheduledRef.current = false; // Unblock before sending
    console.log(`[${timestamp}] 🔓 Unblocking auto-send before force-send`);
    await handleSendInternal(queuedMsg.text, queuedMsg.files);
  };

  const handleRemoveFromQueue = (queuedMessageId: string) => {
    setMessageQueue((prev) => prev.filter(m => m.id !== queuedMessageId));
  };

  // Build a signature to detect both new messages and streaming-like updates
  const contentSignature = (content: ChatContent): string => {
    if (Array.isArray(content)) {
      try {
        return JSON.stringify(content);
      } catch {
        return String(content.length);
      }
    }
    return String(content || "");
  };

  const lastMessage = messages[messages.length - 1];
  const lastSignature = lastMessage ? contentSignature(lastMessage.content) : "";
  const signature = `${messages.length}:${lastSignature.length}:${assistantTyping ? 1 : 0}:${thinkingSteps.length}`;
  const hasHistory = messages.length > 0 || assistantTyping;

  // No debug logs

  const {
    containerRef,
    onScroll,
    scrollToBottom,
  } = useAutoScroll({ signature, isMobile });

  // Ref callback to observe mount/unmount of the scroll container
  const setContainerNode = React.useCallback((node: HTMLDivElement | null) => {
    (containerRef as any).current = node;
    if (node) {
      // Try scroll on next frame to account for layout
      if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        requestAnimationFrame(() => {
          scrollToBottom(false);
        });
        // And again shortly after to catch height animations
        setTimeout(() => {
          scrollToBottom(false);
        }, 160);
      } else {
        scrollToBottom(false);
      }
    }
  }, [containerRef]);

  // No timers now; backend provides reply

  return (
    <div className={cn("flex min-h-0 flex-col", className)} style={style}>
      <div className="mx-auto flex h-full w-full flex-col overflow-hidden border border-border bg-card/50 rounded-lg">
        <div className="relative flex flex-1 min-h-0 flex-col">
          {/* Keep the scroll container mounted to ensure ref is set */}
          <div
            ref={setContainerNode}
            onScroll={onScroll}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-4 space-y-2.5 rb-scroll-thin overscroll-contain",
            )}
            style={{ WebkitOverflowScrolling: "touch" as any }}
          >
            {/* messages list */}
              <AnimatePresence initial={false}>
                {messages.map((m, index) => {
                  const isLastMessage = index === messages.length - 1;
                  const isLastUserMessage = isLastMessage && m.role === "user";
                  const isLastAssistantMessage = isLastMessage && m.role === "assistant";
                  const hasActiveThinking = thinkingSteps.length > 0;
                  
                  // Check if there's an assistant message after this user message
                  const hasAssistantMessageAfter = messages.slice(index + 1).some(msg => msg.role === "assistant");
                  
                  // Show thinking after last user message if no assistant message exists yet
                  const shouldShowThinkingAfterUser = isLastUserMessage && hasActiveThinking && !hasAssistantMessageAfter;
                  // Show thinking before last assistant message
                  const shouldShowThinkingBeforeAssistant = isLastAssistantMessage && hasActiveThinking;
                  
                  return (
                    <React.Fragment key={m.id}>
                      {/* Show active thinking chain right before the last assistant message */}
                      {shouldShowThinkingBeforeAssistant && (
                        <AnimatePresence>
                          <ThinkingChain steps={thinkingSteps} />
                        </AnimatePresence>
                      )}
                      <MessageRowWithGuard
                        m={m}
                        index={index}
                        expandedThinking={expandedThinking}
                        onToggleThinking={(id) => {
                          setExpandedThinking(prev => {
                            const next = new Set(prev);
                            if (next.has(id)) {
                              next.delete(id);
                            } else {
                              next.add(id);
                            }
                            return next;
                          });
                        }}
                      />
                      {/* Show active thinking chain after last user message (before assistant message is created) */}
                      {shouldShowThinkingAfterUser && (
                        <AnimatePresence>
                          <ThinkingChain steps={thinkingSteps} />
                        </AnimatePresence>
                      )}
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>

            {assistantTyping && thinkingSteps.length === 0 && (
              <div className="flex w-full justify-start">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.14 }}
                  className="flex items-center gap-1.5 text-muted-foreground/70"
                  aria-label="Assistant is typing"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: "300ms" }} />
                </motion.div>
              </div>
            )}
          </div>

          <div
            className={cn(
              "sticky bottom-0 left-0 right-0 z-10 w-full bg-card/80 backdrop-blur-sm px-0 py-0",
              !hasHistory && "border-t-transparent"
            )}
          >
            {/* Message Queue Display */}
            <AnimatePresence>
              {messageQueue.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 space-y-2"
                >
                  <div className="text-xs text-muted-foreground/70 px-1 mx-2">
                    Queued messages ({messageQueue.length})
                  </div>
                  <AnimatePresence>
                    {messageQueue.map((queuedMsg) => (
                      <motion.div
                        key={queuedMsg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border mx-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground/80 truncate">
                            {queuedMsg.text}
                          </div>
                          {queuedMsg.files && queuedMsg.files.length > 0 && (
                            <div className="text-xs text-muted-foreground/60 mt-1">
                              {queuedMsg.files.length} attachment{queuedMsg.files.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleForceSend(queuedMsg.id)}
                          className="px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors whitespace-nowrap"
                          title="Interrupt and send now"
                        >
                          Send Now
                        </button>
                        <button
                          onClick={() => handleRemoveFromQueue(queuedMsg.id)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Remove from queue"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {assistantTyping && (
              <div className="mb-2 flex justify-center">
                <button
                  onClick={() => handleStop(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-destructive/10 text-destructive font-medium transition-colors border border-destructive/20"
                  title="Stop generation"
                >
                  <CircleStop className="w-4 h-4" />
                  Stop
                </button>
              </div>
            )}
            <PromptInputBox onSend={handleSend} systemPrompt={systemPrompt} onSystemPromptChange={setSystemPrompt} placeholder={placeholder} />
          </div>

          {/* New message indicator */}
          {/* <AnimatePresence>
            {showNewMessageIndicator && (
              <motion.button
                key="new-msg-indicator"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                onClick={() => {
                  scrollToBottom(true);
                }}
                className="absolute bottom-20 right-6 rounded-full bg-white text-black text-xs px-3 py-1.5 shadow-lg border border-black/10 focus:outline-none"
                aria-label="Jump to latest messages"
              >
                New messages • Jump to latest
              </motion.button>
            )}
          </AnimatePresence> */}
        </div>
      </div>
    </div>
  );
};

// Local component that prevents re-animating old messages
const MessageRowWithGuard: React.FC<{
  m: ChatMessage;
  index: number;
  expandedThinking: Set<string>;
  onToggleThinking: (id: string) => void;
}> = ({ m, index, expandedThinking, onToggleThinking }) => {
  const hasAnimatedRef = React.useRef(false);
  const [hasAnimated, setHasAnimated] = React.useState(hasAnimatedRef.current);

  React.useEffect(() => {
    if (!hasAnimatedRef.current) {
      const id = requestAnimationFrame(() => {
        hasAnimatedRef.current = true;
        setHasAnimated(true);
      });
      return () => cancelAnimationFrame(id);
    }
  }, []);

  return <MessageRowAnimated m={m} disableInitial={hasAnimated} index={index} expandedThinking={expandedThinking} onToggleThinking={onToggleThinking} />;
};

const MessageRowAnimated: React.FC<{
  m: ChatMessage;
  disableInitial: boolean;
  index: number;
  expandedThinking: Set<string>;
  onToggleThinking: (id: string) => void;
}> = ({ m, disableInitial, index, expandedThinking, onToggleThinking }) => {
  const isExpanded = expandedThinking.has(m.id);
  const hasThinking = m.thinkingSteps && m.thinkingSteps.length > 0;

  return (
    <div>
      {hasThinking && m.role === "assistant" && (
        <div className="mb-2 ml-2">
          <button
            onClick={() => onToggleThinking(m.id)}
            className="text-xs text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-1.5 transition-colors px-2 py-1"
          >
            <svg
              className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-90")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{isExpanded ? 'Hide' : 'Show'} reasoning ({m.thinkingSteps!.length} steps)</span>
          </button>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 w-full max-w-full min-w-0"
              >
                <ThinkingChain steps={m.thinkingSteps!} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <ChatMessageBubble
        message={renderChatContent(m.content)}
        isUser={m.role === "user"}
        timestamp={m.createdAt}
        minWidthPct={5}
        maxWidthPct={75}
        disableInitial={disableInitial}
        indexDelay={index * 0.05}
      />
    </div>
  );
};
