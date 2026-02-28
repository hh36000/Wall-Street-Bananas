// Chat API Types

export type ChatContent = string | ChatContentPart[];

export interface ChatContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ChatRequest {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: ChatContent;
  }>;
  conversation_id?: string;
  mod_type?: string;
  files?: Array<{ data: string; filename: string; media_type: string }>; // Files to send to backend
}

export interface ChatResponse {
  content: string;
  events?: ChatEvent[];
}

export interface ChatEvent {
  type: "thinking" | "text" | "tool_use" | "tool_result" | "status" | "done" | "error";
  content?: string;
  display?: string;
  tool?: string;
  tool_use_id?: string;
  args?: any;
  args_json?: string;
  result?: string;
  result_full?: string;
  message?: string;
  error?: string;
  events?: ChatEvent[];
  subagent_name?: string;
}

