from pathlib import Path

from app.brand_kit import load_brand_kit, sample_brief


def test_load_northline_kit():
    path = Path(__file__).resolve().parents[1] / "brand_kit" / "northline.json"
    kit = load_brand_kit(path)
    assert kit.brand_name == "Northline Trail Co."
    assert kit.version == "northline-v1"
    assert "clinically proven" in kit.banned_phrases


def test_sample_brief_shape():
    s = sample_brief()
    assert s.tone in ("calm", "bold", "warm")
    assert len(s.brief) > 20
    assert len(s.audience) > 5
