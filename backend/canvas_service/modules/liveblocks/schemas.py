from pydantic import BaseModel, Field


class LiveblocksAuthRequest(BaseModel):
    room: str | None = None
    user_name: str = Field(default="User", alias="userName")


class ResolveUsersRequest(BaseModel):
    user_ids: list[str] = Field(alias="userIds")


class LiveblocksUserInfo(BaseModel):
    name: str
    avatar: str


class ResolveMentionSuggestionsRequest(BaseModel):
    room_id: str | None = Field(default=None, alias="roomId")
    text: str = ""
