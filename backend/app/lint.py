from app.schemas import BrandKit, Flag


def lint_drafts(
    linkedin_post: str,
    email_subject: str,
    email_body: str,
    kit: BrandKit,
) -> list[Flag]:
    flags: list[Flag] = []
    li = linkedin_post.strip()
    sub = email_subject.strip()
    body = email_body.strip()

    if not li:
        flags.append(Flag(code="empty_linkedin", message="LinkedIn post is empty."))
    if not sub:
        flags.append(Flag(code="empty_email_subject", message="Email subject is empty."))
    if not body:
        flags.append(Flag(code="empty_email_body", message="Email body is empty."))

    if li and len(li) > kit.linkedin_max_chars:
        flags.append(
            Flag(
                code="linkedin_too_long",
                message=f"LinkedIn post exceeds {kit.linkedin_max_chars} characters ({len(li)}).",
            )
        )
    if sub and len(sub) > kit.email_subject_max_chars:
        flags.append(
            Flag(
                code="email_subject_too_long",
                message=f"Email subject exceeds {kit.email_subject_max_chars} characters ({len(sub)}).",
            )
        )

    hay = f"{li}\n{sub}\n{body}".lower()
    for phrase in kit.banned_phrases:
        p = phrase.strip().lower()
        if p and p in hay:
            flags.append(
                Flag(
                    code="banned_phrase",
                    message=f'Banned phrase found: "{phrase}".',
                )
            )
    return flags
