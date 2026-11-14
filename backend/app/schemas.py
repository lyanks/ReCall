from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, HttpUrl


class SignUp(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=120)


class SignIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    name: str

    model_config = {"from_attributes": True}


class ItemCreate(BaseModel):
    url: HttpUrl


class ItemUpdate(BaseModel):
    topic: str = Field(min_length=1, max_length=120)


class ItemOut(BaseModel):
    id: int
    source_type: str
    url: str
    title: str
    topic: str
    status: str
    snippet: str
    created_at: datetime
