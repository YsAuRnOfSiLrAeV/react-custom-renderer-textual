import asyncio
import json

from runtime.dispatcher import handle_message
from transport.socket_transport import send_message
from protocol.schemas import BatchMessage

async def read_loop(reader: asyncio.StreamReader) -> None:
    while True:
        raw_line = await reader.readline()
        if not raw_line:
            print("[py] connection closed by node")
            return

        line = raw_line.decode("utf-8").strip()
        if not line:
            continue

        try:
            msg = json.loads(line)

            if msg.get("type") == "batch":
                parsed_message = BatchMessage.model_validate(msg)
                handle_message(parsed_message.model_dump())
            else:
                handle_message(msg)
                
        except json.JSONDecodeError:
            print("[py] invalid json:", line)


async def write_loop(
  writer: asyncio.StreamWriter,
  outgoing_queue: asyncio.Queue[dict],
) -> None:
    while True:
        message = await outgoing_queue.get()

        if message.get("type") == "__quit__":
            return

        await send_message(writer, message)