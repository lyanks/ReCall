from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...db import get_db
from ..analytics.service import log_event
from .models import User
from .ports import AuthVerifier, InvalidToken
from .service import get_or_create_user

router = APIRouter(tags=["identity"])
bearer = HTTPBearer(auto_error=False)


def current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    verifier: AuthVerifier = request.app.state.auth
    try:
        principal = verifier.verify(creds.credentials)
    except InvalidToken:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    return get_or_create_user(db, principal)


class UserOut(BaseModel):
    id: int
    email: str
    name: str

    model_config = {"from_attributes": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/sessions", status_code=204)
def session_started(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Called by the frontend after each sign-in, so we can measure return visits."""
    log_event(db, user.id, "signin")
    db.commit()
