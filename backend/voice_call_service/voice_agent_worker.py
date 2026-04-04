from livekit.agents import cli

from app.voice_agent.worker import server


def main() -> None:
    cli.run_app(server)


if __name__ == "__main__":
    main()
