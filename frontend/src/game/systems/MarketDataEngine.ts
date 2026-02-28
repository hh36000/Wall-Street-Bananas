import type { MarketDataJSON } from '../types'

interface PriceEntry {
  date: string
  close: number
}

export class MarketDataEngine {
  // ticker -> sorted array of {date, close}
  private pricesByTicker: Map<string, PriceEntry[]> = new Map()
  // sorted list of all trading dates
  private tradingDates: string[] = []
  // quick lookup: "ticker:date" -> close price
  private priceIndex: Map<string, number> = new Map()

  private currentDateIndex = 0

  load(json: MarketDataJSON): void {
    // Group by ticker
    const grouped = new Map<string, PriceEntry[]>()
    for (const rec of json.data) {
      let arr = grouped.get(rec.ticker)
      if (!arr) {
        arr = []
        grouped.set(rec.ticker, arr)
      }
      arr.push({ date: rec.date, close: rec.close })
    }

    // Sort each ticker's prices by date and build index
    const dateSet = new Set<string>()
    for (const [ticker, entries] of grouped) {
      entries.sort((a, b) => a.date.localeCompare(b.date))
      this.pricesByTicker.set(ticker, entries)
      for (const e of entries) {
        this.priceIndex.set(`${ticker}:${e.date}`, e.close)
        dateSet.add(e.date)
      }
    }

    this.tradingDates = Array.from(dateSet).sort()
    this.currentDateIndex = 0
  }

  get allTickers(): string[] {
    return Array.from(this.pricesByTicker.keys())
  }

  get allDates(): string[] {
    return this.tradingDates
  }

  get currentDate(): string {
    return this.tradingDates[this.currentDateIndex] ?? '1987-01-02'
  }

  get totalDays(): number {
    return this.tradingDates.length
  }

  setDateIndex(index: number): void {
    this.currentDateIndex = Math.max(0, Math.min(index, this.tradingDates.length - 1))
  }

  advanceDay(): string | null {
    if (this.currentDateIndex < this.tradingDates.length - 1) {
      this.currentDateIndex++
      return this.currentDate
    }
    return null // no more trading days
  }

  getPrice(ticker: string, date?: string): number | null {
    const d = date ?? this.currentDate
    return this.priceIndex.get(`${ticker}:${d}`) ?? null
  }

  getPreviousPrice(ticker: string, date?: string): number | null {
    const d = date ?? this.currentDate
    const idx = this.tradingDates.indexOf(d)
    if (idx <= 0) return null
    const prevDate = this.tradingDates[idx - 1]
    return this.priceIndex.get(`${ticker}:${prevDate}`) ?? null
  }

  getPriceChange(ticker: string, date?: string): { change: number; pctChange: number } | null {
    const d = date ?? this.currentDate
    const current = this.getPrice(ticker, d)
    const previous = this.getPreviousPrice(ticker, d)
    if (current === null || previous === null) return null
    const change = current - previous
    const pctChange = (change / previous) * 100
    return { change, pctChange }
  }

  getHistory(ticker: string, days: number, date?: string): PriceEntry[] {
    const d = date ?? this.currentDate
    const entries = this.pricesByTicker.get(ticker)
    if (!entries) return []

    const dateIdx = entries.findIndex((e) => e.date === d)
    if (dateIdx < 0) return []

    const startIdx = Math.max(0, dateIdx - days + 1)
    return entries.slice(startIdx, dateIdx + 1)
  }

  getBiggestMovers(date?: string, count = 5): { ticker: string; change: number; pctChange: number }[] {
    const d = date ?? this.currentDate
    const movers: { ticker: string; change: number; pctChange: number }[] = []

    for (const ticker of this.pricesByTicker.keys()) {
      const pc = this.getPriceChange(ticker, d)
      if (pc) {
        movers.push({ ticker, ...pc })
      }
    }

    movers.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))
    return movers.slice(0, count)
  }

  formatDate(date?: string): string {
    const d = date ?? this.currentDate
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
}

export const marketData = new MarketDataEngine()
