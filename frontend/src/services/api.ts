import type { ChatMessage, NPCInteractionEntry } from '../game/types'
import { marketData } from '../game/systems/MarketDataEngine'
import { gameState } from '../game/GameState'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export interface HealthResponse {
  status: string
}

export async function checkHealth(): Promise<HealthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error('Failed to connect to backend. Is the server running?')
    }
    throw err
  }
}

export interface NegotiateRequest {
  trader_id: string
  trader_name: string
  trader_personality: string
  trader_weakness: string
  ticker: string
  current_bid: number
  current_ask: number
  message: string
  conversation_history: ChatMessage[]
  relationship_history: string
}

export interface NegotiateResponse {
  npc_message: string
  trade_accepted: boolean
  updated_bid: number
  updated_ask: number
  favorability_score: number
}

export async function negotiate(req: NegotiateRequest): Promise<NegotiateResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch(`${API_BASE_URL}/negotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Negotiate failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Negotiation timed out')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export function buildRelationshipHistory(npcId: string): string {
  const entries = gameState.npcMemory.get(npcId)
  if (!entries || entries.length === 0) return ''

  const lines: string[] = ['YOUR HISTORY WITH THIS TRADER:', '']

  for (const entry of entries) {
    const formattedDate = marketData.formatDate(entry.date)
    lines.push(`Day ${entry.day} (${formattedDate}):`)

    // Conversation
    if (entry.conversation.length > 0) {
      lines.push('Conversation:')
      for (const msg of entry.conversation) {
        const speaker = msg.role === 'npc' ? 'You' : 'Player'
        lines.push(`  ${speaker}: "${msg.content}"`)
      }
    }

    // Trades
    if (entry.tradesExecuted.length > 0) {
      for (const trade of entry.tradesExecuted) {
        lines.push(`Trades: Player ${trade.side} ${trade.quantity} shares @ $${trade.price.toFixed(2)}`)
      }
    } else {
      lines.push('Trades: No trades executed')
    }

    // Prices
    let priceLine = `Price at time: $${entry.priceAtTime.toFixed(2)}`
    if (entry.nextDayPrice != null) {
      const change = entry.nextDayPrice - entry.priceAtTime
      const changePct = (change / entry.priceAtTime) * 100
      const sign = change >= 0 ? '+' : ''
      priceLine += ` | Next day price: $${entry.nextDayPrice.toFixed(2)} (${sign}${changePct.toFixed(1)}%)`
    }
    lines.push(priceLine)
    lines.push('')
  }

  // Current price
  const firstEntry = entries[0]
  const currentPrice = marketData.getPrice(firstEntry.ticker)
  if (currentPrice != null) {
    lines.push(`Current price today: $${currentPrice.toFixed(2)}`)
  }

  return lines.join('\n')
}
