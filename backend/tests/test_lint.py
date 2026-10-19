# backend/tests/test_lint.py
from app.lint import lint_drafts
from app.schemas import BrandKit


def _kit(**over) -> BrandKit:
    base = dict(
        brand_name="Northline Trail Co.",
        version="northline-v1",
        voice="Calm and practical.",
        do=["Concrete benefits"],
        dont=["Medical claims"],
        banned_phrases=["clinically proven", "guaranteed results", "limited time 90% off"],
        linkedin_max_chars=1300,
        email_subject_max_chars=90,
    )
    base.update(over)
    return BrandKit(**base)


def test_clean_drafts_no_flags():
    flags = lint_drafts(
        linkedin_post="Trail-ready shells for weekend ridgelines.",
        email_subject="New shell for cool mornings",
        email_body="Hi Sam,\n\nSharing a practical update on our ridge shell.\n",
        kit=_kit(),
    )
    assert flags == []


def test_empty_fields():
    codes = {f.code for f in lint_drafts("", "  ", "", _kit())}
    assert codes >= {"empty_linkedin", "empty_email_subject", "empty_email_body"}


def test_linkedin_too_long():
    flags = lint_drafts("x" * 1301, "ok", "body", _kit())
    assert any(f.code == "linkedin_too_long" for f in flags)


def test_email_subject_too_long():
    flags = lint_drafts("post", "s" * 91, "body", _kit())
    assert any(f.code == "email_subject_too_long" for f in flags)


def test_banned_phrase_named_in_message():
    flags = lint_drafts(
        "Our jacket is clinically proven for warmth.",
        "Hello",
        "Body",
        _kit(),
    )
    banned = [f for f in flags if f.code == "banned_phrase"]
    assert banned
    assert "clinically proven" in banned[0].message.lower()
