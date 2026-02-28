import type { Trade, Position } from '../types'
import { gameState } from '../GameState'
import { marketData } from './MarketDataEngine'

export class TradingSystem {
  /**
   * Execute a buy trade. Returns true if successful.
   */
  buy(ticker: string, quantity: number, price: number, npcId: string, npcName: string): boolean {
    const cost = quantity * price

    // Check margin limit: total position value after trade can't exceed max
    const currentPosValue = gameState.totalPositionValue
    const newPosValue = currentPosValue + cost
    if (newPosValue > gameState.maxPositionValue && gameState.capital > 0) {
      return false // would exceed margin
    }

    // Check debt limit
    if (gameState.capital - cost < gameState.maxDebt) {
      return false
    }

    // Update position
    const existing = gameState.positions.get(ticker)
    if (existing) {
      if (existing.quantity >= 0) {
        // Adding to long position
        const totalCost = existing.avgPrice * existing.quantity + price * quantity
        existing.quantity += quantity
        existing.avgPrice = totalCost / existing.quantity
      } else {
        // Covering short position
        existing.quantity += quantity
        if (existing.quantity === 0) {
          gameState.positions.delete(ticker)
        } else if (existing.quantity > 0) {
          // Flipped from short to long
          existing.avgPrice = price
        }
      }
    } else {
      gameState.positions.set(ticker, { ticker, quantity, avgPrice: price })
    }

    // Deduct capital
    gameState.capital -= cost

    // Record trade
    const trade: Trade = {
      day: gameState.dayNumber,
      date: gameState.currentDate,
      ticker,
      side: 'BUY',
      quantity,
      price,
      npcId,
      npcName,
    }
    gameState.todayTrades.push(trade)
    gameState.allTrades.push(trade)

    return true
  }

  /**
   * Execute a sell trade. Returns true if successful.
   */
  sell(ticker: string, quantity: number, price: number, npcId: string, npcName: string): boolean {
    const proceeds = quantity * price

    // Check margin limit for new short positions
    const existing = gameState.positions.get(ticker)
    if (!existing || existing.quantity < quantity) {
      // Creating or expanding a short position
      const shortAmount = quantity - (existing?.quantity ?? 0)
      const newPosValue = gameState.totalPositionValue + shortAmount * price
      if (newPosValue > gameState.maxPositionValue && gameState.capital > 0) {
        return false
      }
    }

    // Update position
    if (existing) {
      if (existing.quantity > 0) {
        // Selling long position
        existing.quantity -= quantity
        if (existing.quantity === 0) {
          gameState.positions.delete(ticker)
        } else if (existing.quantity < 0) {
          // Flipped from long to short
          existing.avgPrice = price
        }
      } else {
        // Adding to short position
        const totalCost = Math.abs(existing.quantity) * existing.avgPrice + quantity * price
        existing.quantity -= quantity
        existing.avgPrice = totalCost / Math.abs(existing.quantity)
      }
    } else {
      // New short position
      gameState.positions.set(ticker, { ticker, quantity: -quantity, avgPrice: price })
    }

    // Add proceeds to capital
    gameState.capital += proceeds

    // Record trade
    const trade: Trade = {
      day: gameState.dayNumber,
      date: gameState.currentDate,
      ticker,
      side: 'SELL',
      quantity,
      price,
      npcId,
      npcName,
    }
    gameState.todayTrades.push(trade)
    gameState.allTrades.push(trade)

    return true
  }

  /**
   * Calculate unrealized P&L for all open positions
   */
  getUnrealizedPnl(): number {
    let total = 0
    for (const pos of gameState.positions.values()) {
      const currentPrice = marketData.getPrice(pos.ticker)
      if (currentPrice !== null) {
        total += (currentPrice - pos.avgPrice) * pos.quantity
      }
    }
    return total
  }

  /**
   * Calculate realized P&L from today's trades
   */
  getTodayRealizedPnl(): number {
    let pnl = 0
    // Track the running position through today's trades
    const dayPositions = new Map<string, { qty: number; avgPrice: number }>()

    for (const trade of gameState.todayTrades) {
      const existing = dayPositions.get(trade.ticker)
      if (trade.side === 'BUY') {
        if (existing && existing.qty < 0) {
          // Covering short: realize P&L
          const covered = Math.min(trade.quantity, Math.abs(existing.qty))
          pnl += (existing.avgPrice - trade.price) * covered
        }
        if (existing) {
          existing.qty += trade.quantity
        } else {
          dayPositions.set(trade.ticker, { qty: trade.quantity, avgPrice: trade.price })
        }
      } else {
        if (existing && existing.qty > 0) {
          // Selling long: realize P&L
          const sold = Math.min(trade.quantity, existing.qty)
          pnl += (trade.price - existing.avgPrice) * sold
        }
        if (existing) {
          existing.qty -= trade.quantity
        } else {
          dayPositions.set(trade.ticker, { qty: -trade.quantity, avgPrice: trade.price })
        }
      }
    }

    return pnl
  }

  /**
   * End of day settlement
   */
  endOfDay(): { realizedPnl: number; unrealizedPnl: number; netPnl: number } {
    const realizedPnl = this.getTodayRealizedPnl()
    const unrealizedPnl = this.getUnrealizedPnl()
    const netPnl = realizedPnl + unrealizedPnl

    // Update debt tracking
    if (gameState.capital < 0) {
      gameState.consecutiveDaysInDebt++
    } else {
      gameState.consecutiveDaysInDebt = 0
    }

    // Check game over
    if (gameState.consecutiveDaysInDebt >= 3) {
      gameState.isGameOver = true
    }

    // Save day result
    gameState.dayResults.push({
      day: gameState.dayNumber,
      date: gameState.currentDate,
      trades: [...gameState.todayTrades],
      realizedPnl,
      unrealizedPnl,
      netPnl,
      endingCapital: gameState.capital,
    })

    gameState.cumulativePnl += netPnl

    return { realizedPnl, unrealizedPnl, netPnl }
  }

  /**
   * Start a new trading day
   */
  startNewDay(): void {
    gameState.todayTrades = []
    gameState.tradingTimeRemaining = gameState.tradingDayLength
    gameState.phase = 'trading'
  }

  /**
   * Get default trade quantity based on capital and price
   */
  getDefaultQuantity(price: number): number {
    // Target ~10% of max position value per trade
    const targetValue = gameState.maxPositionValue * 0.1
    const qty = Math.floor(targetValue / price)
    return Math.max(10, Math.min(qty, 500)) // min 10, max 500 shares
  }
}

export const tradingSystem = new TradingSystem()
