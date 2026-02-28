import os
import json
import logging
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
Today {ticker} is {current_bid}/{current_ask}.
The user will try and negotiate with you.
You are [NORMAL] to SWAY and will never make a trade more than [1%] from your bid/ask open. It will take a convincing side deal to move your price.
Your weakness is [{weakness}]. You will be more likely to accept a deal if the user offers a side deal related to [{weakness}].

{relationship_history}

Consider your full history with this trader when deciding how to respond, how to price your market, and whether to accept trades. If they gave you good advice in the past and stocks moved the way they said, trust them more. If they misled you, be skeptical. Relationships can heal over time.

Stay in character. Keep responses short (1-3 sentences). Be entertaining."""

RESPONSE_SCHEMA = genai.types.Schema(
    type=genai.types.Type.OBJECT,
    required=["npc_message", "trade_accepted", "updated_bid", "updated_ask"],
    properties={
        "npc_message": genai.types.Schema(type=genai.types.Type.STRING),
        "trade_accepted": genai.types.Schema(type=genai.types.Type.BOOLEAN),
        "updated_bid": genai.types.Schema(type=genai.types.Type.NUMBER),
        "updated_ask": genai.types.Schema(type=genai.types.Type.NUMBER),
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
        thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
        response_mime_type="application/json",
        response_schema=RESPONSE_SCHEMA,
        system_instruction=[types.Part.from_text(text=system_prompt)],
    )

    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=contents,
            config=config,
        )

        result = json.loads(response.text)

        # Clamp bid/ask to within 1% of original
        max_bid_move = req.current_bid * 0.01
        max_ask_move = req.current_ask * 0.01

        clamped_bid = max(req.current_bid - max_bid_move, min(req.current_bid + max_bid_move, result["updated_bid"]))
        clamped_ask = max(req.current_ask - max_ask_move, min(req.current_ask + max_ask_move, result["updated_ask"]))

        # Ensure bid < ask
        if clamped_bid >= clamped_ask:
            clamped_bid = req.current_bid
            clamped_ask = req.current_ask

        return NegotiateResponse(
            npc_message=result["npc_message"],
            trade_accepted=result["trade_accepted"],
            updated_bid=round(clamped_bid, 2),
            updated_ask=round(clamped_ask, 2),
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
