export interface MarketRecord {
  date: string
  ticker: string
  close: number
}

export interface MarketDataJSON {
  metadata: {
    tickers: Record<string, string>
    date_range: { first: string; last: string }
  }
  data: MarketRecord[]
}

export interface Position {
  ticker: string
  quantity: number // positive = long, negative = short
  avgPrice: number
}

export interface Trade {
  day: number
  date: string
  ticker: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  npcId: string
  npcName: string
}

export interface NPCQuote {
  bid: number
  ask: number
  spread: number
}

export type SpreadStyle = 'tight' | 'normal' | 'wide'

export interface TraderDef {
  id: string
  name: string
  nickname: string
  ticker: string | null // null for non-trading NPCs like Frank
  personality: string
  greeting: string
  spreadStyle: SpreadStyle
  color: number // hex color for placeholder sprite
}

export interface InteractionLog {
  day: number
  date: string
  summary: string
}

export interface DayResult {
  day: number
  date: string
  trades: Trade[]
  realizedPnl: number
  unrealizedPnl: number
  netPnl: number
  endingCapital: number
}
