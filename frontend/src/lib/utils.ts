import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a conversation ID with timestamp + random suffix
 * Format: YYYYMMDD-HHMMSS-random6chars
 * Example: 20250110-143052-a8f3c2
 */
export function generateConversationId(): string {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .split('.')[0] // YYYYMMDD-HHMMSS
  const random = Math.random().toString(36).substring(2, 8) // 6 random chars
  return `${timestamp}-${random}`
}