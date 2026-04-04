from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
