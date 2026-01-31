from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routes import router
from .worker import start_worker, stop_worker
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Replaces deprecated @app.on_event decorators.
    """
    # Startup: Create database tables
    Base.metadata.create_all(bind=engine)

    # Start worker if not disabled
    if not os.getenv("DISABLE_WORKER"):
        start_worker()
        logging.info("Agent runner started with background worker")
    else:
        logging.info("Agent runner started (worker disabled for testing)")

    yield

    # Shutdown
    if not os.getenv("DISABLE_WORKER"):
        stop_worker()
    logging.info("Agent runner shutting down")


app = FastAPI(title="Agent Runner", lifespan=lifespan)

# Add CORS middleware to allow console to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],  # Console URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
