import type { Position, Trade, InteractionLog, DayResult } from './types'

export class GameState {
  static readonly SANDBOX_MAX_EXPOSURE = 1_000_000_000
  static readonly SANDBOX_MAX_DEBT = -1_000_000_000

  // Day tracking
  dayNumber = 1
  currentDate = '1987-01-02'
  phase: 'morning' | 'trading' | 'summary' = 'morning'

  // Timer
  tradingTimeRemaining = 180 // seconds
  tradingDayLength = 180

  // Money
  capital = 1000
  startingCapital = 1000
  tradeNotional = 100_000 // fixed dollar amount per trade
  maxLeverage = 10
  maxDebt = GameState.SANDBOX_MAX_DEBT

  // Debt tracking
  consecutiveDaysInDebt = 0

  // Positions: ticker -> Position
  positions: Map<string, Position> = new Map()

  // Trade history (all days)
  allTrades: Trade[] = []

  // Today's trades only
  todayTrades: Trade[] = []

  // NPC interaction logs: npcId -> InteractionLog[]
  npcInteractions: Map<string, InteractionLog[]> = new Map()

  // Day results history
  dayResults: DayResult[] = []

  // Cumulative P&L
  cumulativePnl = 0

  // Game over flag
  isGameOver = false

  get maxPositionValue(): number {
    return GameState.SANDBOX_MAX_EXPOSURE
  }

  get totalPositionValue(): number {
    let total = 0
    for (const pos of this.positions.values()) {
      total += Math.abs(pos.quantity * pos.avgPrice)
    }
    return total
  }

  get isInDebt(): boolean {
    return this.capital < 0
  }

  reset(): void {
    this.dayNumber = 1
    this.currentDate = '1987-01-02'
    this.phase = 'morning'
    this.tradingTimeRemaining = this.tradingDayLength
    this.capital = this.startingCapital
    this.consecutiveDaysInDebt = 0
    this.positions.clear()
    this.allTrades = []
    this.todayTrades = []
    this.npcInteractions.clear()
    this.dayResults = []
    this.cumulativePnl = 0
    this.isGameOver = false
  }
}

// Singleton instance
export const gameState = new GameState()
