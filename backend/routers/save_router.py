from fastapi import APIRouter
from pydantic import BaseModel
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/saves", tags=["saves"])

SAVES_DIR = Path(__file__).resolve().parent.parent.parent / "saves"
SAVES_DIR.mkdir(exist_ok=True)

MAX_SLOTS = 3


def _save_path(slot: int) -> Path:
    return SAVES_DIR / f"slot-{slot}.json"


class SaveData(BaseModel):
    playerName: str
    dayNumber: int
    currentDate: str
    cumulativePnl: float
    positions: list
    allTrades: list
    dayResults: list
    npcMemory: list
    favorabilityScores: list = []


@router.post("/{slot}")
async def save_game(slot: int, data: SaveData):
    if slot < 1 or slot > MAX_SLOTS:
        return {"ok": False, "error": f"Slot must be 1-{MAX_SLOTS}"}
    path = _save_path(slot)
    path.write_text(json.dumps(data.model_dump(), indent=2))
    logger.info(f"Game saved for '{data.playerName}' in slot {slot}")
    return {"ok": True}


@router.get("/{slot}")
async def load_game(slot: int):
    if slot < 1 or slot > MAX_SLOTS:
        return {"found": False}
    path = _save_path(slot)
    if not path.exists():
        return {"found": False}
    try:
        data = json.loads(path.read_text())
        return {"found": True, "data": data}
    except Exception as e:
        logger.error(f"Failed to load slot {slot}: {e}")
        return {"found": False}


@router.get("")
async def list_saves():
    """Return summaries for all 3 slots."""
    slots = []
    for i in range(1, MAX_SLOTS + 1):
        path = _save_path(i)
        if path.exists():
            try:
                data = json.loads(path.read_text())
                slots.append({
                    "slot": i,
                    "playerName": data["playerName"],
                    "dayNumber": data["dayNumber"],
                    "cumulativePnl": data["cumulativePnl"],
                })
            except Exception:
                slots.append({"slot": i, "empty": True})
        else:
            slots.append({"slot": i, "empty": True})
    return {"slots": slots}


@router.delete("/{slot}")
async def delete_save(slot: int):
    if slot < 1 or slot > MAX_SLOTS:
        return {"ok": False}
    path = _save_path(slot)
    if path.exists():
        path.unlink()
        logger.info(f"Deleted save slot {slot}")
    return {"ok": True}
