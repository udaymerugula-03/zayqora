"""Validated restaurant imagery persisted to a dedicated public Vercel Blob store."""
from urllib.parse import urlsplit

import httpx

from .config import ROOT
from .models import uid
from .security import fail

BLOB_API_URL = "https://vercel.com/api/blob/"


def store_image(config, restaurant_id, content):
    name = uid() + ".jpg"
    if config.media_backend == "vercel_blob":
        token = config.blob_read_write_token.get_secret_value()
        pathname = f"restaurants/{restaurant_id}/{name}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "image/jpeg",
            "x-content-type": "image/jpeg",
            "x-api-version": "13",
            "x-vercel-blob-access": "public",
            "x-add-random-suffix": "0",
            "x-allow-overwrite": "0",
            "x-cache-control-max-age": "31536000",
        }
        parts = token.split("_")
        if len(parts) >= 5 and parts[:3] == ["vercel", "blob", "rw"]:
            headers["x-vercel-blob-store-id"] = parts[3]
        try:
            with httpx.Client(timeout=httpx.Timeout(30, connect=10), follow_redirects=False) as client:
                response = client.put(BLOB_API_URL, params={"pathname": pathname},
                                      headers=headers, content=content)
            if not response.is_success:
                fail(503, "Durable image storage rejected the upload. Check the dedicated public "
                     "Vercel Blob store and server-side BLOB_READ_WRITE_TOKEN.", "media_storage_unavailable")
            result = response.json()
            url = result.get("url", "")
            parsed = urlsplit(url)
            if (parsed.scheme != "https" or not parsed.hostname
                    or not parsed.hostname.endswith(".public.blob.vercel-storage.com")
                    or parsed.username or parsed.password or parsed.query or parsed.fragment
                    or result.get("pathname") != pathname):
                fail(503, "Durable image storage returned an invalid image location.",
                     "media_storage_unavailable")
            return url
        except (httpx.RequestError, ValueError, TypeError, AttributeError):
            # Provider errors and request objects can contain tokens; never relay or log them.
            fail(503, "Durable image storage is unavailable. No local production fallback was used.",
                 "media_storage_unavailable")
    if config.media_backend == "development_local":
        directory = ROOT / ".uploads"
        directory.mkdir(exist_ok=True)
        (directory / name).write_bytes(content)
        return "/media/" + name
    fail(503, "Durable object storage is not configured. Set BLOB_READ_WRITE_TOKEN for a dedicated "
         "public Vercel Blob store. Local uploads are development-only.", "media_storage_unavailable")
