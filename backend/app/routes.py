from fastapi import APIRouter, HTTPException, Request

from app.brand_kit import load_brand_kit, sample_brief
from app.config import Settings, get_settings
from app.generate import GenerateError, generate_run
from app.lint import lint_drafts
from app.ollama_client import OllamaClient
from app.schemas import (
    BrandKit,
    GenerateRequest,
    HealthResponse,
    PatchRunRequest,
    Run,
    RunSummary,
    SampleBrief,
)

router = APIRouter()


def get_ollama() -> OllamaClient:
    return OllamaClient(get_settings())


@router.get("/health", response_model=HealthResponse)
def health(request: Request):
    settings: Settings = request.app.state.settings
    client = get_ollama()
    ok = client.health()
    return HealthResponse(
        status="ok" if ok else "degraded",
        ollama=ok,
        model=settings.ollama_chat_model,
    )


@router.get("/brand-kit", response_model=BrandKit)
def brand_kit(request: Request):
    return load_brand_kit(request.app.state.settings.brand_kit_path)


@router.get("/sample-brief", response_model=SampleBrief)
def get_sample_brief():
    return sample_brief()


@router.post("/generate", response_model=Run)
def post_generate(body: GenerateRequest, request: Request):
    if not body.brief.strip() or not body.audience.strip():
        raise HTTPException(status_code=400, detail="Brief and audience are required.")
    kit = load_brand_kit(request.app.state.settings.brand_kit_path)
    try:
        return generate_run(body, kit=kit, db=request.app.state.db, client=get_ollama())
    except GenerateError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get("/runs", response_model=list[RunSummary])
def list_runs(request: Request):
    return request.app.state.db.list_runs()


@router.get("/runs/{run_id}", response_model=Run)
def get_run(run_id: str, request: Request):
    run = request.app.state.db.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    return run


@router.patch("/runs/{run_id}", response_model=Run)
def patch_run(run_id: str, body: PatchRunRequest, request: Request):
    db = request.app.state.db
    current = db.get_run(run_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    linkedin = body.linkedin_post if body.linkedin_post is not None else current.linkedin_post
    subject = body.email_subject if body.email_subject is not None else current.email_subject
    email_body = body.email_body if body.email_body is not None else current.email_body
    kit = load_brand_kit(request.app.state.settings.brand_kit_path)
    flags = lint_drafts(linkedin, subject, email_body, kit)
    if body.status == "ready_not_published":
        if not linkedin.strip() or not email_body.strip():
            raise HTTPException(
                status_code=400,
                detail={"message": "Cannot approve empty drafts.", "flags": [f.model_dump() for f in flags]},
            )
    updated = db.update_run(
        run_id,
        linkedin_post=body.linkedin_post,
        email_subject=body.email_subject,
        email_body=body.email_body,
        status=body.status,
        flags=flags,
    )
    return updated
