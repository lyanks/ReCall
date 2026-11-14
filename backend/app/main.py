from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from . import extract, topics
from .config import CORS_ORIGINS
from .db import Base, engine, get_db
from .models import Event, Item, User
from .schemas import ItemCreate, ItemOut, ItemUpdate, SignIn, SignUp, TokenOut, UserOut
from .security import create_token, current_user, hash_password, verify_password

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ЗБІРКА API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def log(db: Session, user: User, kind: str) -> None:
    db.add(Event(user_id=user.id, kind=kind))


def to_out(item: Item, query: str | None = None) -> ItemOut:
    snippet = item.text[:200]
    if query and item.text:
        pos = item.text.lower().find(query.lower())
        if pos >= 0:
            start = max(0, pos - 80)
            snippet = ("…" if start else "") + item.text[start : pos + 120] + "…"
    return ItemOut(
        id=item.id, source_type=item.source_type, url=item.url, title=item.title,
        topic=item.topic, status=item.status, snippet=snippet, created_at=item.created_at,
    )


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- auth ----------

@app.post("/auth/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignUp, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This email is already registered")
    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    log(db, user, "signup")
    db.commit()
    return TokenOut(access_token=create_token(user.id))


@app.post("/auth/signin", response_model=TokenOut)
def signin(body: SignIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    log(db, user, "signin")
    db.commit()
    return TokenOut(access_token=create_token(user.id))


@app.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


# ---------- items ----------

@app.post("/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def add_item(body: ItemCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    url = str(body.url)
    try:
        ex = extract.extract(url)
        item = Item(owner_id=user.id, source_type=ex.source_type, url=url, title=ex.title,
                    text=ex.text, topic=topics.guess_topic(ex.title, ex.text))
    except Exception:
        item = Item(owner_id=user.id, source_type=extract.detect_type(url), url=url,
                    title=url, status="failed")
    db.add(item)
    log(db, user, "add_item")
    db.commit()
    db.refresh(item)
    return to_out(item)


@app.get("/items", response_model=list[ItemOut])
def list_items(q: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Item).where(Item.owner_id == user.id)
    if q:
        # v0: keyword search. v1: semantic search over embeddings.
        like = f"%{q}%"
        stmt = stmt.where(or_(Item.title.ilike(like), Item.text.ilike(like), Item.topic.ilike(like)))
        log(db, user, "search")
        db.commit()
    items = db.scalars(stmt.order_by(Item.created_at.desc())).all()
    return [to_out(i, q) for i in items]


def _own_item(item_id: int, user: User, db: Session) -> Item:
    item = db.get(Item, item_id)
    if item is None or item.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@app.patch("/items/{item_id}", response_model=ItemOut)
def update_item(item_id: int, body: ItemUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = _own_item(item_id, user, db)
    item.topic = body.topic.strip()
    db.commit()
    return to_out(item)


@app.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own_item(item_id, user, db))
    db.commit()
