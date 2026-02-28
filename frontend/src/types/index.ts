// API Types based on backend analysis
export interface User {
  user_id: string
  name: string
  email?: string
  created_at: string
  presentation_count: number
  asset_count: number
}

export interface Presentation {
  presentation_id: string
  title: string
  created_at: string
  status: string
  original_gcs_path?: string
}

export interface Asset {
  asset_id: string
  filename: string
  asset_type: string
  created_at: string
  gcs_path?: string
}

export interface ChatMessage {
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface OrchestratorStatus {
  initialized: boolean
  current_file: string | null
  selected_presentation: string | null
}

export interface OperationJob {
  id: string
  user_id: string
  presentation_id: string
  operation_type: string
  status: 'starting' | 'processing' | 'uploading' | 'completed' | 'failed'
  user_request: string
  progress_message: string
  error_message?: string
  output_files?: {
    pptx_url?: string
    pptx_signed_url?: string
    pdf_url?: string
    pdf_signed_url?: string
  }
  pdf_version?: number
  started_at: string
  completed_at?: string
  updated_at: string
  metadata?: {
    approval_requests?: Record<string, ApprovalRequest>
    tool_calls?: Array<{
      timestamp: string
      tool_name: string
      tool_arguments: any
    }>
  }
}

export interface ApprovalRequest {
  id: string
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'denied'
  created_at: string
  plan_description: string
  operation: {
    type: string
    description: string
    context: string
    what_to_look_out_for: string
  }
  operation_type: string
  operation_description: string
  total_operations: number
  denied_at?: string
  approved_at?: string
  executed_at?: string
  execution_result?: string
}