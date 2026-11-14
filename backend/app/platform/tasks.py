"""Port: TaskQueue. Slow work (fetching and parsing a link) runs outside the request,
the API answers 202 + id right away (course module 5-6).

Adapters:
- ThreadTaskQueue: in-process thread pool. Enough for one small container.
- InlineTaskQueue: runs the job immediately; used in tests.
When load grows, add an RQ/Celery or Cloud Tasks adapter; callers do not change.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Protocol


class TaskQueue(Protocol):
    def enqueue(self, fn: Callable[..., Any], *args: Any) -> None: ...


class ThreadTaskQueue:
    def __init__(self, workers: int = 4):
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="job")

    def enqueue(self, fn, *args):
        self._pool.submit(fn, *args)


class InlineTaskQueue:
    def enqueue(self, fn, *args):
        fn(*args)
