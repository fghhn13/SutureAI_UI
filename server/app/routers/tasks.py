from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Task
from ..schemas import TaskOut

router = APIRouter(prefix="/api/tasks", tags=["tasks"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)) -> list[Task]:
    return list(db.scalars(select(Task).order_by(Task.sort_order, Task.name)))
