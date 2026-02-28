import type { NPCQuote, TraderDef } from '../types'
import { marketData } from './MarketDataEngine'

// Spread amounts by style (in dollars)
const SPREAD_MAP = {
  tight: 0.125,
  normal: 0.25,
  wide: 0.5,
} as const

export class NPCManager {
  /**
   * Generate a bid/ask quote for an NPC's stock.
   * Pure math, no AI needed.
   */
  generateQuote(trader: TraderDef): NPCQuote | null {
    if (!trader.ticker) return null

    const currentPrice = marketData.getPrice(trader.ticker)
    if (currentPrice === null) return null

    const halfSpread = SPREAD_MAP[trader.spreadStyle]

    // Add small random noise (±$0.0625) to feel organic
    const noise = (Math.random() - 0.5) * 0.125

    const bid = Math.round((currentPrice - halfSpread + noise) * 100) / 100
    const ask = Math.round((currentPrice + halfSpread + noise) * 100) / 100

    return {
      bid: Math.max(0.01, bid),
      ask: Math.max(bid + 0.01, ask),
      spread: Math.round((ask - bid) * 100) / 100,
    }
  }

  /**
   * Format a price in 1980s trading style (fractions of dollars)
   */
  formatPrice(price: number): string {
    return `$${price.toFixed(2)}`
  }

  /**
   * Format a quote as a trading floor announcement
   */
  formatQuote(trader: TraderDef, quote: NPCQuote): string {
    return `${trader.ticker}: ${this.formatPrice(quote.bid)} bid, ${this.formatPrice(quote.ask)} offer`
  }
}

export const npcManager = new NPCManager()
