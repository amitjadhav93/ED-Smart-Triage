"""
ED Smart Triage Assistant - backend entrypoint.

Run with:
    uvicorn main:app --port 5000
or simply:
    python main.py
"""
import asyncio
import contextlib
import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.errors import register_exception_handlers
from app.patient_service import run_wait_threshold_auto_retriage_sweep
from app.routers import misc, patients

AUTO_RETRIAGE_SWEEP_INTERVAL_SECONDS = 15


async def _background_auto_retriage_loop():
    while True:
        await asyncio.sleep(AUTO_RETRIAGE_SWEEP_INTERVAL_SECONDS)
        try:
            run_wait_threshold_auto_retriage_sweep()
        except Exception:
            # Never let a background sweep failure take down the server.
            pass


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_background_auto_retriage_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="ED Smart Triage Assistant API",
    description="Clinical decision-support backend for a hackathon ED triage prototype.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(patients.router)
app.include_router(misc.router)


@app.get("/")
def root():
    return {
        "service": "ED Smart Triage Assistant API",
        "docs": "/docs",
        "edProfile": settings.ed_profile,
        "integrationMode": settings.integration_mode,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", settings.port)), reload=False)
