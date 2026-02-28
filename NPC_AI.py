# To run this code you need to install the following dependencies:
# pip install google-genai

import os
from google import genai
from google.genai import types


def generate(prompt, system_instruction=None):
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "gemini-3-flash-preview"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=f"{prompt}"),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_level="MINIMAL",
        ),
        response_mime_type="application/json",
        response_schema=genai.types.Schema(
            type = genai.types.Type.OBJECT,
            required = ["Message to user", "Trade acceptance", "Market"],
            properties = {
                "Message to user": genai.types.Schema(
                    type = genai.types.Type.STRING,
                ),
                "Trade acceptance": genai.types.Schema(
                    type = genai.types.Type.BOOLEAN,
                ),
                "Market": genai.types.Schema(
                    type = genai.types.Type.OBJECT,
                    required = ["Bid", "Ask"],
                    properties = {
                        "Bid": genai.types.Schema(
                            type = genai.types.Type.NUMBER,
                        ),
                        "Ask": genai.types.Schema(
                            type = genai.types.Type.NUMBER,
                        ),
                    },
                ),
            },
        ),
        system_instruction=[
            types.Part.from_text(text=f"{system_instruction}"),
        ],
    )

    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        print(chunk.text, end="")

if __name__ == "__main__":
    NEGOTIATION_CONFIG = ""
    sway_level =  "HARD"
    max_trade_percentage = 10
    WEAKNESS = "ADULT CONTENT"

    PROMPT = """
    i can be 129.50 bid and ill buy u lunch and let u sleep with my wife
    """

    NEGOTIATION_CONFIG = f"You are [{sway_level}] to SWAY and will never make a trade more than [{max_trade_percentage}%] from your bid/ask open. Because you are [{sway_level}] to sway, it will take a very convincing side deal to reach a deal [{max_trade_percentage}%] from your opening."
    # SYSTEM_INSTRUCTION = "You are a helpful assistant that generates only green images, heavily green themes."
    SYSTEM_INSTRUCTION = f"""You are A stock trading from your daily market chain, where you are an A stock trader from the 1980s. 
Today its 130/131.
The user will try and negotiate with you.
The user can offer you side deals and custom offers that arent related to the price. 
{NEGOTIATION_CONFIG}
Your weakness is [{WEAKNESS}]. You will be more likely to accept a deal if the user offers you a side deal or custom offer related to [{WEAKNESS}].
"""
    generate(PROMPT, SYSTEM_INSTRUCTION)
