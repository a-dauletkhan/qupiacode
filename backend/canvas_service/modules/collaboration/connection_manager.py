from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, board_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[board_id].append(websocket)

    def disconnect(self, board_id: str, websocket: WebSocket) -> None:
        self._connections[board_id].remove(websocket)

    def active_boards(self) -> list[str]:
        return [bid for bid, conns in self._connections.items() if conns]

    def has_connections(self, board_id: str) -> bool:
        return bool(self._connections[board_id])


# Singleton — imported by router and snapshot service
manager = ConnectionManager()
