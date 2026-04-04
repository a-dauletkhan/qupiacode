from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import threading
import time
from collections.abc import Sequence
from pathlib import Path
from typing import TextIO

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the unified backend API and the voice worker together."
    )
    parser.add_argument(
        "--worker-mode",
        choices=("start", "dev", "connect"),
        default=os.environ.get("VOICE_AGENT_RUN_MODE", "connect"),
        help="Worker command to run alongside the API.",
    )
    parser.add_argument(
        "--room",
        default=os.environ.get("VOICE_AGENT_CONNECT_ROOM", "canvas:demo-canvas"),
        help="Room name used when worker-mode=connect.",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("APP_HOST", "0.0.0.0"),
        help="Host for the FastAPI server.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", os.environ.get("APP_PORT", "8000"))),
        help="Port for the FastAPI server.",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Run uvicorn with --reload for local development.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without starting them.",
    )
    return parser.parse_args()


def build_api_command(args: argparse.Namespace) -> list[str]:
    venv_python = str(BACKEND_ROOT / ".venv" / "bin" / "python")
    python_executable = venv_python if os.path.exists(venv_python) else sys.executable
    command = [
        python_executable,
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        args.host,
        "--port",
        str(args.port),
    ]
    if args.reload:
        command.append("--reload")
    return command


def build_worker_command(args: argparse.Namespace) -> list[str]:
    venv_python = str(BACKEND_ROOT / ".venv" / "bin" / "python")
    python_executable = venv_python if os.path.exists(venv_python) else sys.executable
    command = [python_executable, "voice_agent_worker.py", args.worker_mode]
    if args.worker_mode == "connect":
        command.extend(["--room", args.room])
    return command


def start_process(label: str, command: Sequence[str]) -> subprocess.Popen[str]:
    process = subprocess.Popen(
        list(command),
        cwd=BACKEND_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    if process.stdout is None:
        raise RuntimeError(f"Failed to capture stdout for {label}.")

    thread = threading.Thread(
        target=_pipe_output,
        args=(label, process.stdout),
        daemon=True,
    )
    thread.start()
    return process


def _pipe_output(label: str, stream: TextIO) -> None:
    while True:
        line = stream.readline()
        if not line:
            break
        print(f"[{label}] {line.rstrip()}")


def stop_processes(processes: dict[str, subprocess.Popen[str]]) -> None:
    for process in processes.values():
        if process.poll() is None:
            process.terminate()

    deadline = time.time() + 5
    for process in processes.values():
        if process.poll() is not None:
            continue
        timeout = max(0.0, deadline - time.time())
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> int:
    args = parse_args()
    api_command = build_api_command(args)
    worker_command = build_worker_command(args)

    print(f"[backend-stack] api: {' '.join(api_command)}")
    print(f"[backend-stack] worker: {' '.join(worker_command)}")

    if args.dry_run:
        return 0

    processes = {
        "api": start_process("api", api_command),
        "worker": start_process("worker", worker_command),
    }

    def _handle_signal(_signum: int, _frame: object) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        while True:
            for label, process in processes.items():
                return_code = process.poll()
                if return_code is None:
                    continue

                print(
                    f"[backend-stack] {label} exited with code {return_code}, stopping the stack"
                )
                stop_processes(processes)
                return return_code

            time.sleep(0.25)
    except KeyboardInterrupt:
        print("[backend-stack] stopping the stack")
        stop_processes(processes)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
