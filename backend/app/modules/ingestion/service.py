"""Ingestion pipeline: fetch the source, extract text, assign a topic, ask the LLM for a digest.
Runs as a background job."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from ..ai.adapters import NoLLM
from ..ai.ports import LLMClient
from ..files import extract as file_formats
from ..files.ports import FileStore
from ..library.models import Item, content_unknown, is_upload
from .ports import ContentExtractor, Extracted, TopicClassifier

log = logging.getLogger(__name__)

UNSORTED = "Unsorted"
# The AI digest sees at most this much text (~3-4k tokens, roughly 6-8 pages), whatever the file's length.
# Search still uses the whole extracted text, which costs no tokens.
AI_INPUT_CHARS = 12_000


class IngestionService:
    def __init__(self, extractors: list[ContentExtractor], classifier: TopicClassifier, session_factory: sessionmaker,
                 llm: LLMClient | None = None, files: FileStore | None = None):
        self.files = files
        self.extractors = extractors
        self.classifier = classifier
        self.session_factory = session_factory
        self.llm = llm or NoLLM()

    def detect_type(self, url: str) -> str:
        return self._extractor_for(url).source_type

    def _extractor_for(self, url: str) -> ContentExtractor:
        return next(e for e in self.extractors if e.supports(url))

    def process(self, item_id: int, keep_topic: bool = False) -> None:
        db: Session = self.session_factory()
        try:
            item = db.get(Item, item_id)
            if item is None:
                return
            try:
                ex = self._extract(item)
                if not item.custom_title:
                    item.title = ex.title or item.url
                item.text = ex.text
                item.image_url = ex.image or item.image_url
                if is_upload(item) and item.source_type == "image":
                    item.image_url = item.url  # the uploaded photo is its own preview
                if not keep_topic:
                    item.topic = self.classifier.classify(ex.title, ex.text)
            except Exception:
                log.exception("ingestion failed for item %s", item_id)
                item.status = "failed"
                db.commit()
                return
            if is_upload(item) and not item.text:
                # a picture or a scan: only the AI can say what it is, so stay "processing" until it has
                # (otherwise the UI would ask for key phrases a moment before the summary arrives)
                db.commit()
                self._digest(db, item, may_set_topic=not keep_topic)
                item.status = "ready"
                db.commit()
                return
            item.status = "ready"
            db.commit()
            self._digest(db, item, may_set_topic=not keep_topic)
        finally:
            db.close()

    def _extract(self, item: Item) -> Extracted:
        if not is_upload(item):
            return self._extractor_for(item.url).extract(item.url)
        blob = self.files.load(item.id) if self.files else None
        if blob is None:
            raise FileNotFoundError(f"no stored file for item {item.id}")
        return file_formats.extract(blob.filename, blob.data)

    def _digest(self, db: Session, item: Item, may_set_topic: bool) -> None:
        """AI summary + key topics. Optional: on any error the item stays as it is (ready, no summary)."""
        if not self.llm.enabled or content_unknown(item):  # nothing to summarise: the user adds key phrases
            return
        try:
            topics = db.scalars(select(Item.topic).where(Item.owner_id == item.owner_id).distinct()).all()
            text, url, image = item.text or "", item.url, None
            if len(text) > AI_INPUT_CHARS:
                text = text[:AI_INPUT_CHARS] + "\n[first part of a longer document]"
            if is_upload(item):
                url = "uploaded file"  # the download link means nothing to the model
                if item.source_type == "image":
                    blob = self.files.load(item.id) if self.files else None
                    if blob is None:
                        return
                    image = (blob.content_type, blob.data)
            kwargs = {"image": image} if image else {}
            d = self.llm.digest(item.title, text, url, item.source_type,
                                [t for t in topics if t != UNSORTED], **kwargs)
        except Exception:
            log.exception("AI digest failed for item %s", item.id)
            return
        item.summary, item.summary_en = d.summary_uk, d.summary_en
        item.key_topics, item.key_topics_en, item.keywords = d.key_topics, d.key_topics_en, " ".join(d.keywords) or item.title or item.url
        # The keyword rules know only a few subjects; let the model file what they could not.
        if may_set_topic and item.topic == UNSORTED and d.topic:
            item.topic = d.topic
        db.commit()

    def backfill(self, limit: int = 300) -> None:
        """Digest items that have none yet (saved before the key, or cleared to regenerate). Runs at start-up."""
        if not self.llm.enabled:
            return
        db: Session = self.session_factory()
        try:
            items = db.scalars(select(Item).where(Item.status == "ready", Item.keywords == "")
                               .order_by(Item.id.desc()).limit(limit)).all()
            for item in items:
                self._digest(db, item, may_set_topic=False)
        except Exception:
            log.exception("AI backfill stopped")
        finally:
            db.close()
