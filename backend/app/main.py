from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from . import auth, owner, platform, public
from .config import ROOT, Settings, settings
from .db import configure_db
from .security import RateLimiter


def create_app(config: Settings | None = None, testing=False):
    config = config or settings()

    @asynccontextmanager
    async def lifespan(app):
        if not testing:
            config.validate_runtime()
        if not hasattr(app.state, "session_factory"):
            configure_db(app, config.database_url)
        yield
        app.state.engine.dispose()

    app = FastAPI(title="ZAYQORA Release 1", version="1.0.0", lifespan=lifespan)
    app.state.config = config
    app.state.limiter = RateLimiter()
    app.add_middleware(CORSMiddleware,
                       allow_origins=[origin.strip() for origin in config.cors_origins.split(",") if origin.strip()],
                       allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
                       allow_headers=["Authorization", "Content-Type", "Idempotency-Key"])

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        body = {"detail": exc.detail}
        if exc.headers and exc.headers.get("X-Error-Code"):
            body["code"] = exc.headers["X-Error-Code"]
        return JSONResponse(status_code=exc.status_code, content=body, headers=exc.headers)

    @app.middleware("http")
    async def safe_headers(request: Request, call_next):
        if request.method in {"POST", "PATCH"}:
            limit = (4 * 1024 * 1024 + 65536) if request.url.path == "/api/v1/media" else 1024 * 1024
            chunks, length = [], 0
            async for chunk in request.stream():
                length += len(chunk)
                if length > limit:
                    return JSONResponse(status_code=413, content={"detail": "Request body is too large."},
                                        headers={"Cache-Control": "no-store",
                                                 "X-Content-Type-Options": "nosniff"})
                chunks.append(chunk)
            request._body = b"".join(chunks)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        if not request.url.path.startswith("/media/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/health", tags=["Operations"], include_in_schema=False)
    @app.get("/api/v1/health", tags=["Operations"])
    def health():
        try:
            with app.state.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except Exception:
            return JSONResponse(status_code=503, content={"status": "unavailable", "database": "unavailable"})
        return {"status": "ok", "database": "connected",
                "email": "smtp_configured" if config.smtp_configured else "provider_not_configured",
                "media": config.media_backend,
                "payments": "cash_only"}

    for router in (auth.router, public.router, owner.router, platform.router):
        app.include_router(router, prefix="/api/v1")
    if config.media_backend == "development_local":
        directory = ROOT / ".uploads"
        directory.mkdir(exist_ok=True)
        app.mount("/media", StaticFiles(directory=str(directory)), name="media")
    return app


app = create_app()
