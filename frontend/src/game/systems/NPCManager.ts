import type { NPCQuote, TraderDef } from '../types'
import { marketData } from './MarketDataEngine'

// Half-spread as a fraction of current price (percentage-based)
const SPREAD_PCT_MAP = {
  tight: 0.00125, // 0.125% half-spread → ~0.25% round-trip
  normal: 0.0025, // 0.25%  half-spread → ~0.5% round-trip
  wide: 0.005,    // 0.5%   half-spread → ~1% round-trip
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

    const halfSpread = currentPrice * SPREAD_PCT_MAP[trader.spreadStyle]

    // Add small random noise (±0.1% of price) to feel organic
    const noise = currentPrice * (Math.random() - 0.5) * 0.002

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
