import { gameState } from '../GameState'
import type { Position, Trade, DayResult, NPCInteractionEntry } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

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

export interface SlotSummary {
  slot: number
  empty?: boolean
  playerName?: string
  dayNumber?: number
  cumulativePnl?: number
}

function buildSaveData(): SaveData {
  return {
    playerName: gameState.playerName,
    dayNumber: gameState.dayNumber,
    currentDate: gameState.currentDate,
    cumulativePnl: gameState.cumulativePnl,
    positions: Array.from(gameState.positions.entries()),
    allTrades: gameState.allTrades,
    dayResults: gameState.dayResults,
    npcMemory: Array.from(gameState.npcMemory.entries()),
  }
}

function applyLoadData(data: SaveData): void {
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
}

export const SaveManager = {
  save(slot?: number): void {
    const s = slot ?? gameState.saveSlot
    const data = buildSaveData()
    fetch(`${API_BASE_URL}/saves/${s}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {})
  },

  async load(slot: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/saves/${slot}`)
      const json = await res.json()
      if (!json.found) return false
      applyLoadData(json.data as SaveData)
      gameState.saveSlot = slot
      return true
    } catch {
      return false
    }
  },

  async listSlots(): Promise<SlotSummary[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/saves`)
      const json = await res.json()
      return json.slots as SlotSummary[]
    } catch {
      return [
        { slot: 1, empty: true },
        { slot: 2, empty: true },
        { slot: 3, empty: true },
      ]
    }
  },

  deleteSave(slot: number): void {
    fetch(`${API_BASE_URL}/saves/${slot}`, { method: 'DELETE' }).catch(() => {})
  },
}
