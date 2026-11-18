from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from datetime import datetime

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ... import config

from ...db import get_db
from ..analytics.service import log_event
from .models import User
from .ports import AuthVerifier, InvalidToken, PasswordAccounts
from .service import get_or_create_user, is_login_email

router = APIRouter(tags=["identity"])
EMAIL_RE = r"^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$"
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
    login: str | None = None
    pending_email: str = ""
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    # email a login account wants to confirm (Firebase sends the link; see auth.js addEmail)
    pending_email: str | None = Field(default=None, max_length=255, pattern=EMAIL_RE)


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.name is not None:
        user.name = body.name.strip()
    if body.pending_email is not None:
        user.pending_email = body.pending_email.strip().lower()
    db.commit()
    return user


# ---- login accounts: sign-in by login and password reset (no token: the user is signed out) ----

class LoginIn(BaseModel):
    login: str = Field(min_length=1, max_length=255)
    password: str = Field(default="", max_length=4096)


def _passwords(request: Request) -> PasswordAccounts:
    return request.app.state.passwords


def _by_login(db: Session, login: str) -> User | None:
    return db.scalar(select(User).where(User.login == login.strip().lower()))


@router.post("/auth/resolve")
def resolve_login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    """Which email to sign in with for a login. A login account that added its own email only gets the address
    back with the right password, so a login never reveals somebody's email."""
    login = body.login.strip().lower()
    user = _by_login(db, login)
    synthetic = f"{login}@{config.LOGIN_DOMAIN}"
    if user is None or (is_login_email(user.email) and not user.pending_email):
        return {"email": synthetic}
    candidates = [user.email] + ([user.pending_email] if user.pending_email else [])
    for email in candidates:
        if _passwords(request).check_password(email, body.password):
            if email != user.email:  # the new address was confirmed while the user was signed out
                user.email, user.pending_email = email, ""
                db.commit()
            return {"email": email}
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, {"code": "auth/invalid-credential", "message": "Wrong login or password"})


@router.post("/sessions", status_code=204)
def session_started(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Called by the frontend after each sign-in, so we can measure return visits."""
    log_event(db, user.id, "signin")
    db.commit()
