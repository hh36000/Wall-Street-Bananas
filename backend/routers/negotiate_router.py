import os
import json
import logging
import random
import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize Gemini client once at module level
_client = None

def get_client():
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable not set")
        _client = genai.Client(api_key=api_key)
    return _client


class ConversationMessage(BaseModel):
    role: str  # "npc" or "user"
    content: str


class NegotiateRequest(BaseModel):
    trader_id: str
    trader_name: str
    trader_personality: str
    trader_weakness: str
    ticker: str
    current_bid: float
    current_ask: float
    message: str
    conversation_history: list[ConversationMessage] = []
    relationship_history: str = ""


class NegotiateResponse(BaseModel):
    npc_message: str
    trade_accepted: bool
    updated_bid: float
    updated_ask: float


SYSTEM_PROMPT_TEMPLATE = """You are {trader_name}, a stock trader on the 1980s Wall Street trading floor.
Your personality: {personality}
Today {ticker} is {current_bid}/{current_ask} (bid/offer).
You are a market maker. Your BID is where you BUY from the user. Your OFFER (ask) is where you SELL to the user.
If the user wants to buy at a lower price, you move your OFFER (updated_ask) down. If the user wants to sell at a higher price, you move your BID (updated_bid) up.
The user will try and negotiate with you.
Your weakness is [{weakness}]. You will be more likely to accept a deal if the user offers a side deal related to [{weakness}].

{relationship_history}

Consider your full history with this trader when deciding how to respond, how to price your market, and whether to accept trades. If they gave you good advice in the past and stocks moved the way they said, trust them more. If they misled you, be skeptical. Relationships can heal over time.

Stay in character. Keep responses short (1-3 sentences). Be entertaining."""

RESPONSE_SCHEMA = genai.types.Schema(
    type=genai.types.Type.OBJECT,
    required=["npc_message", "trade_accepted", "updated_bid", "updated_ask"],
    properties={
        "npc_message": genai.types.Schema(type=genai.types.Type.STRING, description="The message the NPC will say to the user."),
        "trade_accepted": genai.types.Schema(type=genai.types.Type.BOOLEAN, description="Whether the trade was accepted or not."),
        "updated_bid": genai.types.Schema(type=genai.types.Type.NUMBER, description="The updated bid price. This is the price you will buy the stock at. It should change if you agree to a trade at a different price"),
        "updated_ask": genai.types.Schema(type=genai.types.Type.NUMBER, description="The updated ask price. This is the price you will sell the stock at. It should change if you agree to a trade at a different price"),
    },
)


@router.post("/negotiate", response_model=NegotiateResponse)
async def negotiate(req: NegotiateRequest):
    relationship_section = ""
    if req.relationship_history:
        relationship_section = f"\nYOUR HISTORY WITH THIS TRADER:\n{req.relationship_history}\n"

    max_move_pct = random.randint(1, 5)

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        trader_name=req.trader_name,
        personality=req.trader_personality,
        ticker=req.ticker,
        current_bid=f"${req.current_bid:.2f}",
        current_ask=f"${req.current_ask:.2f}",
        weakness=req.trader_weakness,
        max_move_pct=max_move_pct,
        relationship_history=relationship_section,
    )

    # Build conversation contents for Gemini
    contents = []
    for msg in req.conversation_history:
        role = "model" if msg.role == "npc" else "user"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg.content)],
            )
        )

    # Add the current user message
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=req.message)],
        )
    )

    config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="LOW"),
        response_mime_type="application/json",
        response_schema=RESPONSE_SCHEMA,
        system_instruction=[types.Part.from_text(text=system_prompt)],
    )

    try:
        client = get_client()
        response = None
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model="gemini-3.1-pro-preview",
                    contents=contents,
                    config=config,
                )
                break
            except Exception as e:
                if "429" in str(e) and attempt < 2:
                    delay = 1 * (2 ** attempt)
                    logger.warning(f"429 rate limited, retrying in {delay}s (attempt {attempt + 1}/3)")
                    await asyncio.sleep(delay)
                else:
                    raise

        result = json.loads(response.text)

        updated_bid = result["updated_bid"]
        updated_ask = result["updated_ask"]

        # Ensure bid < ask, reset to original if invalid
        if updated_bid >= updated_ask:
            updated_bid = req.current_bid
            updated_ask = req.current_ask

        logger.info("--------------------------------")

        logger.info(f"Updated bid: {updated_bid}, Updated ask: {updated_ask}")
        logger.info(f"Message: {result['npc_message']}")
        logger.info(f"Trade accepted: {result['trade_accepted']}")
        logger.info("--------------------------------")

        return NegotiateResponse(
            npc_message=result["npc_message"],
            trade_accepted=result["trade_accepted"],
            updated_bid=round(updated_bid, 2),
            updated_ask=round(updated_ask, 2),
        )

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        # Return in-character fallback without changing prices
        return NegotiateResponse(
            npc_message="Eh, hold on a sec... *gets distracted* ...what were we talkin' about?",
            trade_accepted=False,
            updated_bid=req.current_bid,
            updated_ask=req.current_ask,
        )
