"""Ingestion pipeline: fetch the source, extract text, assign a topic. Runs as a background job."""

import logging

from sqlalchemy.orm import Session, sessionmaker

from ..library.models import Item
from .ports import ContentExtractor, TopicClassifier

log = logging.getLogger(__name__)


class IngestionService:
    def __init__(self, extractors: list[ContentExtractor], classifier: TopicClassifier, session_factory: sessionmaker):
        self.extractors = extractors
        self.classifier = classifier
        self.session_factory = session_factory

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
                ex = self._extractor_for(item.url).extract(item.url)
                item.title, item.text = ex.title or item.url, ex.text
                if not keep_topic:
                    item.topic = self.classifier.classify(ex.title, ex.text)
                item.status = "ready"
            except Exception:
                log.exception("ingestion failed for item %s", item_id)
                item.status = "failed"
            db.commit()
        finally:
            db.close()
