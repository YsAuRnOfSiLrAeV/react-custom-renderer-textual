from typing import Literal, Union

from pydantic import BaseModel


class CreateOp(BaseModel):
    type: Literal["op"]
    op: Literal["create"]
    id: str
    elementType: str
    props: dict


class AppendChildOp(BaseModel):
    type: Literal["op"]
    op: Literal["appendChild"]
    parentId: str
    childId: str


class UpdatePropsOp(BaseModel):
    type: Literal["op"]
    op: Literal["updateProps"]
    id: str
    props: dict


class RemoveChildOp(BaseModel):
    type: Literal["op"]
    op: Literal["removeChild"]
    parentId: str
    childId: str


class InsertBeforeOp(BaseModel):
    type: Literal["op"]
    op: Literal["insertBefore"]
    parentId: str
    childId: str
    beforeChildId: str


Operation = Union[
  CreateOp,
  AppendChildOp,
  InsertBeforeOp,
  UpdatePropsOp,
  RemoveChildOp,
]


class BatchMessage(BaseModel):
    type: Literal["batch"]
    ops: list[Operation]


class EventMessage(BaseModel):
    type: Literal["event"]
    eventName: str
    targetId: str
    payload: dict
