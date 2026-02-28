
# To run this code you need to install the following dependencies:
# pip install google-genai

import mimetypes
import os
from google import genai
from google.genai import types

from dotenv import load_dotenv

load_dotenv()


def save_binary_file(file_name, data):
    f = open(file_name, "wb")
    f.write(data)
    f.close()
    print(f"File saved to to: {file_name}")


def generate(prompt, aspect_ratio, image_size, file_name=None, system_instruction="Generate the requested image."):
    client = genai.Client(
        api_key=os.getenv("GEMINI_API_KEY"),
    )

    model = "gemini-3.1-flash-image-preview"
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
        image_config = types.ImageConfig(
            aspect_ratio=aspect_ratio,
            image_size=image_size,
        ),
        response_modalities=[
            "IMAGE",
        ],
        system_instruction=[
            types.Part.from_text(text=f"{system_instruction}"),
        ],
    )

    file_index = 0
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if (
            chunk.parts is None
        ):
            continue
        if chunk.parts[0].inline_data and chunk.parts[0].inline_data.data:
            prompt_start = prompt[:6].replace(" ", "_").replace(".", "_")
            if file_name is not None:
                file_name = file_name
            else:
                file_name = f"{prompt_start}_{file_index}"
            file_index += 1
            inline_data = chunk.parts[0].inline_data
            data_buffer = inline_data.data
            file_extension = mimetypes.guess_extension(inline_data.mime_type)
            save_path = f"outputs/{file_name}{file_extension}"
            save_binary_file(save_path, data_buffer)
        else:
            print(chunk.text)

if __name__ == "__main__":
    SYSTEM_INSTRUCTION = None
    # SYSTEM_INSTRUCTION = "You are a helpful assistant that generates only green images, heavily green themes."
    PROMPT = """PLAYER: Tiny simple 16-bit pixel art character sprite, top-down RPG style similar to Pokémon Ruby/Sapphire overworld sprites. Extremely small and simple, only 24x32 pixels, minimal detail, 4-5 colors maximum per character, on a transparent background. Young man, brown hair, blue jacket, khaki pants.
    """
    FILENAME = "player"
    ASPECT_RATIO = "1:1"
    IMAGE_SIZE = "512x512"
    generate(PROMPT, ASPECT_RATIO, IMAGE_SIZE, FILENAME, SYSTEM_INSTRUCTION)
