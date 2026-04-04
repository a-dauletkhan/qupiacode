from __future__ import annotations

from livekit.agents import cli

from voice_call_service.app.voice_agent.worker import server


def main() -> None:
    cli.run_app(server)


if __name__ == "__main__":
    main()
