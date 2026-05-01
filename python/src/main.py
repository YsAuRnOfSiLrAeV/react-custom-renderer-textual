import asyncio

from runtime import runtime_state
from transport.connection_loops import read_loop, write_loop
from runtime.textual_runtime import RendererApp

PORT = 7261


async def main() -> None:
    # Buffer between Textual events and write_loop
    outgoing_queue: asyncio.Queue[dict] = asyncio.Queue()
    runtime_state.outgoing_queue = outgoing_queue

    # Signal that Textual app is mounted and ready
    ui_ready = asyncio.Event()
    runtime_state.ui_ready = ui_ready

    app = RendererApp()
    app_task = asyncio.create_task(app.run_async())

    # Wait until RendererApp.on_mount registers mount_child
    await ui_ready.wait()

    reader, writer = await asyncio.open_connection("127.0.0.1", PORT)
    print(f"[py] connected to port {PORT}")

    read_task = asyncio.create_task(read_loop(reader))
    write_task = asyncio.create_task(write_loop(writer, outgoing_queue))

    # Only now let Node send the first batch
    await outgoing_queue.put({"type": "ready"})

    try:
        await app_task
    finally:
        await outgoing_queue.put({"type": "__quit__"})
        await write_task

        writer.close()
        await writer.wait_closed()

        if not read_task.done():
            read_task.cancel()

        try:
            await read_task
        except asyncio.CancelledError:
            pass

        print("[py] closed")


if __name__ == "__main__":
    asyncio.run(main())