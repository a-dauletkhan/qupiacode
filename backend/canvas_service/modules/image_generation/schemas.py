from enum import Enum

from pydantic import BaseModel, Field


class ImageGenerationRequest(BaseModel):
    node_id: str = Field(min_length=1, description="Canvas node id for the image placeholder.")
    text: str = Field(min_length=1, description="Prompt text for image generation.")
    resolution: str = Field(
        min_length=1,
        description="Requested aspect ratio or resolution, for example 16:9.",
    )


class ImageGenerationResponse(BaseModel):
    status: str
    request_id: str


class GenerationStatus(str, Enum):
    queued = "queued"
    in_progress = "in_progress"
    nsfw = "nsfw"
    failed = "failed"
    completed = "completed"
    canceled = "canceled"


class GenerationImage(BaseModel):
    url: str


class GenerationStatusResponse(BaseModel):
    request_id: str
    status: GenerationStatus
    status_url: str | None = None
    cancel_url: str | None = None
    images: list[GenerationImage] = []
