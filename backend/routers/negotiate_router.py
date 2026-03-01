import os
import re
import json
import logging
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
    favorability_score: float

SYSTEM_PROMPT_TEMPLATE = """You are {trader_name}, a stock trader on the 1980s Wall Street trading floor.
Your personality: {personality}
Today {ticker} is {current_bid}/{current_ask} (bid/offer).
You are a market maker. Your BID is where you BUY from the user. Your OFFER (ask) is where you SELL to the user.
If the user wants to buy at a lower price, you move your OFFER (updated_ask) down. If the user wants to sell at a higher price, you move your BID (updated_bid) up.
The user will try and negotiate with you.
Your weakness is [{weakness}]. You will be more likely to accept a deal if the user offers a side deal related to [{weakness}].

{relationship_history}

Consider your full history with this trader when deciding how to respond, how to price your market, and whether to accept trades. If they gave you good advice in the past and stocks moved the way they said, trust them more. If they misled you, be skeptical. Relationships can heal over time.

CRITICAL PRICING RULE: The prices you mention in your npc_message MUST EXACTLY match the updated_bid and updated_ask values you return. First decide what your new bid and ask prices are, then write your message referencing those exact numbers. Never say one price in your message but return a different number. For example, if you say "I'll offer at three-fifty", then updated_ask MUST be 3.50. If you aren't moving your prices, updated_bid and updated_ask should remain {current_bid} and {current_ask}.

Stay in character. Keep responses short (1-3 sentences). Be entertaining."""

PRICE_VALIDATION_SCHEMA = genai.types.Schema(
    type=genai.types.Type.OBJECT,
    required=["override", "reasoning"],
    properties={
        "override": genai.types.Schema(type=genai.types.Type.BOOLEAN, description="True if the structured bid/ask values do NOT match the prices in the NPC message and need correcting."),
        "reasoning": genai.types.Schema(type=genai.types.Type.STRING, description="Short explanation of what prices were found in the message vs the structured values."),
        "updated_bid": genai.types.Schema(type=genai.types.Type.NUMBER, description="Corrected bid price extracted from the message. Only set if override is true."),
        "updated_ask": genai.types.Schema(type=genai.types.Type.NUMBER, description="Corrected ask price extracted from the message. Only set if override is true."),
    },
)


async def validate_prices(client, npc_message: str, bid: float, ask: float) -> dict | None:
    """Use Flash to verify that structured bid/ask match the NPC message text."""
    try:
        prompt = (
            f"An NPC trader said this message:\n\"{npc_message}\"\n\n"
            f"The system recorded bid={bid:.2f}, ask={ask:.2f}.\n\n"
            "Do the prices mentioned in the message match these bid/ask values? "
            "If the message mentions specific prices that differ from the recorded values, "
            "set override=true and provide the correct bid and ask from the message. "
            "If the message doesn't mention specific prices, or the prices match, set override=false."
        )
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PRICE_VALIDATION_SCHEMA,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        logger.warning(f"Flash price validation failed: {e}")
        return None


RESPONSE_SCHEMA = genai.types.Schema(
    type=genai.types.Type.OBJECT,
    required=["npc_message", "trade_accepted", "updated_bid", "updated_ask", "favorability_score"],
    properties={
        "npc_message": genai.types.Schema(type=genai.types.Type.STRING, description="Your in-character response. Any prices you mention in this message MUST exactly match updated_bid and updated_ask."),
        "trade_accepted": genai.types.Schema(type=genai.types.Type.BOOLEAN, description="Whether the trade was accepted or not."),
        "updated_bid": genai.types.Schema(type=genai.types.Type.NUMBER, description="Your new bid price (where you buy). Must match any bid price mentioned in npc_message. Keep unchanged if you are not moving your price."),
        "updated_ask": genai.types.Schema(type=genai.types.Type.NUMBER, description="Your new ask/offer price (where you sell). Must match any offer price mentioned in npc_message. Keep unchanged if you are not moving your price."),
        "favorability_score": genai.types.Schema(type=genai.types.Type.NUMBER, description="The favorability score of the trader. This is a number between 0 and 100. 100 is the most favorable, 0 is the least favorable."),
    },
)


@router.post("/negotiate", response_model=NegotiateResponse)
async def negotiate(req: NegotiateRequest):
    relationship_section = ""
    if req.relationship_history:
        relationship_section = f"\nYOUR HISTORY WITH THIS TRADER:\n{req.relationship_history}\n"

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        trader_name=req.trader_name,
        personality=req.trader_personality,
        ticker=req.ticker,
        current_bid=f"${req.current_bid:.2f}",
        current_ask=f"${req.current_ask:.2f}",
        weakness=req.trader_weakness,
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

        # Flash validation: sync bid/ask with what the NPC actually said
        validation = await validate_prices(client, result["npc_message"], updated_bid, updated_ask)
        if validation:
            logger.info(f"Flash validation reasoning: {validation.get('reasoning', 'N/A')}")
            if validation.get("override"):
                flash_bid = validation.get("updated_bid", updated_bid)
                flash_ask = validation.get("updated_ask", updated_ask)
                if flash_bid != updated_bid:
                    logger.info(f"Flash override: bid {updated_bid}->{flash_bid}")
                    updated_bid = flash_bid
                if flash_ask != updated_ask:
                    logger.info(f"Flash override: ask {updated_ask}->{flash_ask}")
                    updated_ask = flash_ask

        logger.info("--------------------------------")

        logger.info(f"Updated bid: {updated_bid}, Updated ask: {updated_ask}")
        logger.info(f"Message: {result['npc_message']}")
        logger.info(f"Trade accepted: {result['trade_accepted']}")
        logger.info(f"Favorability score: {result['favorability_score']}")
        logger.info("--------------------------------")

        return NegotiateResponse(
            npc_message=result["npc_message"],
            trade_accepted=result["trade_accepted"],
            updated_bid=round(updated_bid, 2),
            updated_ask=round(updated_ask, 2),
            favorability_score=result["favorability_score"],
        )

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        # Return in-character fallback without changing prices
        return NegotiateResponse(
            npc_message="Eh, hold on a sec... *gets distracted* ...what were we talkin' about?",
            trade_accepted=False,
            updated_bid=req.current_bid,
            updated_ask=req.current_ask,
            favorability_score=50,
        )
