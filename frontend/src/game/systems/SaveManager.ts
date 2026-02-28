import { gameState } from '../GameState'
import type { Position, Trade, DayResult, NPCInteractionEntry } from '../types'

const SAVE_KEY = 'wsb-save'

interface SaveData {
  playerName: string
  dayNumber: number
  currentDate: string
  cumulativePnl: number
  positions: [string, Position][]
  allTrades: Trade[]
  dayResults: DayResult[]
  npcMemory: [string, NPCInteractionEntry[]][]
}

export interface SaveSummary {
  playerName: string
  dayNumber: number
  cumulativePnl: number
}

export const SaveManager = {
  save(): void {
    const data: SaveData = {
      playerName: gameState.playerName,
      dayNumber: gameState.dayNumber,
      currentDate: gameState.currentDate,
      cumulativePnl: gameState.cumulativePnl,
      positions: Array.from(gameState.positions.entries()),
      allTrades: gameState.allTrades,
      dayResults: gameState.dayResults,
      npcMemory: Array.from(gameState.npcMemory.entries()),
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  },

  load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false

    try {
      const data: SaveData = JSON.parse(raw)
      gameState.playerName = data.playerName
      gameState.dayNumber = data.dayNumber
      gameState.currentDate = data.currentDate
      gameState.cumulativePnl = data.cumulativePnl
      gameState.positions = new Map(data.positions)
      gameState.allTrades = data.allTrades
      gameState.dayResults = data.dayResults
      gameState.npcMemory = new Map(data.npcMemory)
      gameState.todayTrades = []
      gameState.npcInteractions.clear()
      gameState.phase = 'morning'
      gameState.isGameOver = false
      return true
    } catch {
      return false
    }
  },

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null
  },

  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY)
  },

  getSaveSummary(): SaveSummary | null {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null

    try {
      const data: SaveData = JSON.parse(raw)
      return {
        playerName: data.playerName,
        dayNumber: data.dayNumber,
        cumulativePnl: data.cumulativePnl,
      }
    } catch {
      return null
    }
  },
}
