# WALL ST BANANAS — Developer Manual

## Core Day Trading Simulation Only

---

## What This MVP Is

This is the stripped-down first playable version. The player walks around the NYSE trading floor, talks to AI-driven NPC traders, buys and sells stocks at real historical prices, and tries to make money. That's it. No bar, no apartment, no purchases, no evening events. Just the trading pit, the NPCs, and the market.

If this works and feels good, everything else layers on top.

---

## Scenes (4 total)

### 1. Boot Scene
Loads all assets (backgrounds, sprites, market data JSON). Shows a simple loading bar. Transitions to Morning Scene when done.

### 2. Morning Scene
A simple info screen at the start of each day. Shows:

- Current date (e.g., "Monday, January 5, 1987")
- Day number (e.g., "Day 3")
- 2-3 Gemini-generated news headlines based on today's actual price movements. Feed Gemini the biggest movers of the day and ask it to write short 1980s-style financial news blurbs.
- Yesterday's P&L (skip on day 1)
- Current capital and debt status
- A "Start Trading" button

That's it. No animation, no fancy transitions. A dark background with text and a button.

### 3. Trading Floor Scene (THE GAME)
The main and only gameplay scene. Everything happens here.

**The world:**
- The trading floor background image is the ground layer.
- The world is larger than the screen. The camera is zoomed in (2x-3x) and follows the player.
- 25 NPC sprites stand at fixed positions around the floor. They do not move.
- Each NPC has two text labels floating near them: their nickname above, and their stock ticker below.

**The player:**
- A single static sprite that slides around when arrow keys or WASD are pressed. No animation.
- Collides with world boundaries.
- The camera follows with slight smoothing.

**Interacting with NPCs:**
- When the player overlaps with an NPC sprite, a "Press E to trade" prompt appears.
- Pressing E opens the trade dialog (described below) as an overlay on top of the trading floor. Player movement pauses.
- Closing the dialog resumes movement.

**The trade dialog (overlay panel):**
This appears over the trading floor when talking to an NPC. It contains:

- NPC name and nickname
- Their stock and current bid/ask quote
- A chat log showing the conversation
- A text input where the player types messages (use a DOM HTML input overlaid on the canvas — Phaser has no native text input)
- Three buttons: "Hit Bid" (sell at their bid), "Lift Offer" (buy at their ask), "Walk Away" (close)

How a conversation flows:
1. Dialog opens. A Gemini call fires with the NPC's full system prompt. The NPC greets the player and states their current quote.
2. The player types a message (e.g., "tighten that up" or "I'll take 200 shares" or just chatting). A new Gemini call fires.
3. The NPC responds in character. They may adjust their price, refuse, banter, or agree to a trade.
4. If the player clicks "Hit Bid" or "Lift Offer," the trade executes immediately at the displayed price. No Gemini call needed.
5. If the NPC's Gemini response contains the structured tag `[TRADE: BUY/SELL TICKER QTY PRICE]`, the trade executes automatically.
6. The player clicks "Walk Away" to close and return to the floor.

**The quick trade path:** The player can always just walk up to an NPC, press E, and immediately click "Hit Bid" or "Lift Offer" without any conversation. The quote is generated mathematically from the market price plus spread. This lets the player trade fast without waiting for API calls.

**The HUD:**
Displayed as a fixed overlay on the camera (doesn't scroll with the world). Shows:

- Current capital (e.g., "$1,247.50")
- Today's P&L (green if positive, red if negative)
- Day number
- Time remaining in the trading day (countdown from 2-3 minutes)
- Current open positions as a compact list (e.g., "IBM: +100 @ $134.25 | GE: -50 @ $48.50")

**The day timer:**
A countdown runs during trading. Each day is 2-3 real-time minutes. When it hits zero, the trading day ends and the game transitions to the Day Summary Scene.

### 4. Day Summary Scene
An end-of-day results screen. Shows:

- List of all trades made today (stock, quantity, price, which NPC)
- Today's realized P&L (closed positions)
- Today's unrealized P&L (open positions marked to market against closing prices)
- Net P&L for the day
- Updated total capital
- If capital is negative: debt amount and which day of debt this is (Day 1, Day 2, or Day 3)
- If 3 days in debt: "GAME OVER" message with final stats (days survived, peak capital, total trades) and a "Try Again" button that resets everything
- Otherwise: a "Next Day" button that goes to Morning Scene

---

## Systems (4 total)

### 1. Market Data Engine

Provides real stock prices from the 1980s.

**Data:** A JSON file with daily close prices for 25 S&P 100 stocks from 1985-1989. Structure: an object where each key is a ticker symbol, and the value is an array of objects with `date` and `close` fields, sorted chronologically.

**What it does:**
- Tracks the current game date. Starts on January 2, 1987. Advances one real trading day per game day.
- Returns the current price for any ticker (today's close).
- Returns the last N days of price history for any ticker (for Gemini prompts).
- Calculates today's price change vs yesterday for each stock (for HUD ticker display and morning news).
- Identifies the biggest movers of the day (for morning news generation).

**25 stocks, one per NPC:**  see the file in the backend

### 2. Trading System

Tracks everything about the player's money and positions.

**Positions:** A map of ticker → quantity and average price. Positive quantity means long (player owns shares). Negative means short (player owes shares).

**Executing a trade:**
- When the player buys: subtract cost from capital, add to position (or reduce a short).
- When the player sells: add proceeds to capital, reduce position (or create a short).
- Record the trade in history with day, ticker, side, quantity, price, and which NPC.

**End-of-day settlement:**
- For each open position, calculate unrealized P&L: (current price - avg price) × quantity.
- Sum realized P&L from all closed trades today.
- Update capital.

**Capital and debt:**
- Capital = starting $1,000 + all realized P&L from all days.
- If capital goes negative, the player is borrowing. Track how many consecutive days capital has been negative.
- Maximum debt: -$10,000. Reject trades that would exceed this.
- 3 consecutive days of negative capital = game over.
- Returning to positive capital resets the debt day counter.

### 3. NPC Manager

Manages all 25 traders.

**Quote generation (no AI, instant):**
- Take the current market price for the NPC's stock.
- Apply spread: tight style = ±$0.125, normal = ±$0.25, wide = ±$0.50.
- Add small random noise so quotes feel organic.
- This is what displays in the trade dialog when it first opens.

**Conversation (Gemini):**
- When the player sends a chat message, build a Gemini prompt with: the NPC's personality, quirk, stock, current price, 5-day history, all past interactions with the player, the player's wealth level, and the current game day.
- Send to Gemini. Display the response in the chat log.
- Parse the response for the structured trade tag. If found, execute the trade.
- Append a summary of the interaction to the NPC's memory log. This log grows over the course of the game and gets fed into every future call — this is the long-context memory.
- You should be using configs for each NPC on their negotiation style. Set categories for flecibility [Low, Medium, High] which determines the price % they are willing to flex to if they accept your offer and also LMH for a config set where it determines how much u have to sway to get them to move their price for example an npc who is easy to sway you can just be friendly, for a hard sway you may have to promise to pay for their first born's college. These will change each day for each NPC and will be provided to gemini in the system prompt for the day. 

**Fallback:** If Gemini is slow (timeout after 5-10 seconds) or errors, display the NPC's static fallback greeting and their mathematical quote. The game must be playable without AI.

### 4. Game State

A single shared object that all scenes read and write to. Contains:

- Current day number and historical date
- Current phase (morning / trading / summary)
- Time remaining in trading day
- Capital, debt amount, consecutive days in debt
- All positions and trade history
- NPC interaction logs (map of NPC ID → array of interaction summaries)
- Cumulative P&L

This is just a TypeScript object held in memory. No database, no localStorage needed for the MVP. If the page refreshes, the game resets. That's fine.

---

## Asset List (MVP)

| Asset | Type | Description |
|-------|------|-------------|
| trading-floor.png | Background | The main NYSE floor, 3/4 isometric pixel art. Already generated. |
| player.png | Sprite | Tiny top-down pixel art player character. Already generated. |
| 25 NPC PNGs | Sprites | One per trader, tiny top-down pixel art. Prompts ready in sprite-prompts.json. |
| market-data.json | Data | Daily close prices for 25 stocks, 1985-1989. Must be downloaded and formatted. |
| traders.ts | Config | 25 NPC personality definitions. Already written. |

That's it. No UI images needed — the HUD, dialog box, labels, and buttons can all be built with Phaser's text and rectangle drawing. Keep it simple.

---

## The Full MVP Loop

```
BOOT → load assets

MORNING (Day 1)
  Show date: January 2, 1987
  Gemini generates 2-3 news headlines from today's price data
  Show capital: $1,000
  Player clicks "Start Trading"

TRADING (2-3 minutes)
  Player walks around the pit
  Player approaches Vinny → presses E → dialog opens
  Vinny (via Gemini): "You want IBM? Talk fast. 134 bid, 134 and three quarters offer."
  Player types: "I'll lift your offer on 100 shares"
  Vinny: "Done. 100 IBM at 134.75. Don't say I never gave you anything. [TRADE: SELL IBM 100 134.75]"
  Trade executes: player now long 100 IBM at $134.75, capital reduced by $13,475... 
  
  Wait — player only has $1,000. 
  
  IMPORTANT DESIGN DECISION: Position sizes need to be scaled to the player's capital. 
  Either:
  (a) The player trades in small lots (10-20 shares) appropriate to their capital, OR
  (b) The game uses a leverage/margin system where $1,000 in capital lets you 
      control larger positions (like real trading), OR
  (c) Stock prices are scaled down (fictional pricing) — but this conflicts with 
      "real market data"
  
  RECOMMENDATION: Use margin. The player's $1,000 is margin capital. They can hold 
  positions up to 10x their capital ($10,000 in stock). This is realistic for 1980s 
  floor trading and lets positions be meaningful. P&L is based on price movement, 
  not the full position cost. A 100-share position in IBM moving $0.50 = $50 profit, 
  which is meaningful against $1,000 capital.
  
  Player walks to another NPC, sells IBM at a better price, captures spread.
  Timer counts down.

DAY SUMMARY
  Show today's trades
  Show P&L: +$37.50
  Show capital: $1,037.50
  Player clicks "Next Day"

MORNING (Day 2)
  Date advances to January 5, 1987
  New prices load
  Gemini generates new headlines
  NPC interaction logs now include yesterday's conversations
  Player clicks "Start Trading"

TRADING (Day 2)
  Player walks up to Vinny again
  Vinny (via Gemini): "Back for more IBM? You did alright yesterday, kid. 
  I'll go 135 bid, 135 and a half offer."
  ^^^ Vinny remembers yesterday. This is the whole point.

... repeat ...

DAY SUMMARY (capital went negative)
  Capital: -$2,300
  "WARNING: You are $2,300 in debt. Day 1 of 3."
  
DAY SUMMARY (3rd consecutive day of debt)
  "GAME OVER. The mob sends its regards."
  Final stats. Try Again button.
```

---

## Gemini Calls in the MVP

Only two types of Gemini calls exist in the MVP:

**1. NPC conversation (on each player message in trade dialog)**
- Input: system prompt with NPC personality + market data + interaction history + player message
- Output: NPC's in-character response, possibly containing a trade tag
- Frequency: every time the player sends a chat message, so potentially 5-20 times per trading day
- Latency matters: keep prompts concise, use streaming if available

**2. Morning news (once per day)**
- Input: today's biggest price movers with their percentage changes, ask for 2-3 short 1980s-style financial headlines
- Output: 2-3 headline strings
- Frequency: once per game day
- Latency doesn't matter: player is reading the morning screen anyway

---

## What Makes the MVP Demo-Worthy

Even without the bar, apartment, and progression, this MVP demonstrates the hackathon prompt perfectly:

**Persistent memory:** Walk up to an NPC on day 5 and they reference something from day 1. The entire interaction history is in the context window.

**Genuine agency:** Each NPC negotiates differently based on their personality. Vinny is aggressive. Quiet Mike barely talks. Big Donna gossips about other traders. The Professor lectures about fundamentals. Bobby Fresh is terrible at pricing on day 1 but gets better.

**Evolving world:** The market moves every day with real data. NPCs adjust their behavior based on accumulated interactions. The player's reputation with each NPC shifts over time. By day 10, the floor feels alive.

**The demo pitch:** "I walked onto the trading floor with $1,000 and no friends. By day 10, Vinny respects me because I always trade big with him. Mama Rosa gives me better prices because she thinks I'm a nice kid. Slick Rick tried to mislead me about Ford on day 3, and when I called him on it on day 7, he got defensive and widened his spread. None of this is scripted. It's all Gemini remembering and reacting."

---

## Build Order

Do these in this exact order. Each step produces something testable.

**Step 1: Scaffold and boot.**
Get Vite + Phaser + TypeScript running. Boot Scene loads the trading floor background and player sprite. Display the background with the player standing on it. Verify arrow keys move the player and the camera follows.

**Step 2: Place NPCs.**
Load all 25 NPC sprites. Place them on the trading floor at fixed positions. Add name and stock labels. Verify the player can walk around and see all NPCs. Add overlap detection so "Press E" appears when near an NPC.

**Step 3: Market data.**
Load the market data JSON. Build the market engine. Verify you can query any stock's current price and history for a given game date.

**Step 4: Trade dialog (no AI yet).**
Build the overlay panel with NPC name, stock, bid/ask (from mathematical quote generation), and Hit Bid / Lift Offer / Walk Away buttons. Wire up the buttons to execute trades. Build the trading system to track positions and capital. Display positions in a basic HUD. Verify you can buy from one NPC and sell to another and see P&L update.

**Step 5: Day cycle.**
Add the trading day timer. Build the Day Summary Scene showing trades and P&L. Build the Morning Scene with static placeholder text. Wire the full loop: morning → trading → summary → morning. Advance the market date each day. Verify the game loops through multiple days and prices change.

**Step 6: Gemini NPC conversations.**
Add the text input to the trade dialog. Wire up Gemini calls with the NPC system prompt. Verify NPCs respond in character. Parse trade tags from responses. Add the fallback for when Gemini is slow.

**Step 7: NPC memory.**
Start logging interaction summaries. Feed the growing log into subsequent Gemini calls. Verify that an NPC on day 3 references something from day 1. This is the finish line for the MVP.

**Step 8: Morning news.**
Add a Gemini call in the Morning Scene to generate headlines. Quick win, one call, looks great.

**Step 9: Debt and game over.**
Add the debt tracker. Build the Game Over Scene with final stats and a restart button. Wire up Frankie Five Fingers to give warnings when debt is active.

**Step 10: Polish.**
Tune NPC positions on the map. Adjust camera zoom. Tune trading day length. Tune spread sizes. Playtest the full loop twice. Fix the worst bugs.
