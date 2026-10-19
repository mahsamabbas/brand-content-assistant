import json
from pathlib import Path

from app.schemas import BrandKit, SampleBrief


def load_brand_kit(path: str | Path) -> BrandKit:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return BrandKit.model_validate(data)


def sample_brief() -> SampleBrief:
    return SampleBrief(
        brief=(
            "Announce the Ridge Shell jacket for cool shoulder-season hikes. "
            "Emphasize packability, repairable zippers, and quiet weather protection. "
            "Invite people to try it on a weekend loop — no hype, no invented discounts."
        ),
        audience="Weekend hikers and bike-to-trail commuters in temperate climates",
        tone="calm",
    )
