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
