import io

import httpx
import pytest
from PIL import Image
from pydantic import SecretStr

from conftest import login


def image_bytes():
    output = io.BytesIO()
    Image.new("RGB", (20, 20), "teal").save(output, "PNG")
    return output.getvalue()


def mock_blob_transport(monkeypatch, handler):
    client_type = httpx.Client
    monkeypatch.setattr("app.media.httpx.Client",
                        lambda **kwargs: client_type(transport=httpx.MockTransport(handler), **kwargs))


def test_production_blob_upload_is_validated_tenant_scoped_and_public(api, monkeypatch):
    client, factory, password = api
    auth = login(client, password)
    tenant_id = client.get("/api/v1/restaurant", headers=auth).json()["id"]
    config = client.app.state.config
    config.app_env = "production"
    config.blob_read_write_token = SecretStr("vercel_blob_rw_teststore_dummy")
    calls = []

    def provider(request):
        assert request.method == "PUT"
        assert request.url.host == "vercel.com"
        assert request.url.path == "/api/blob/"
        pathname = request.url.params["pathname"]
        assert pathname.startswith(f"restaurants/{tenant_id}/")
        assert pathname.endswith(".jpg") and ".." not in pathname
        assert request.headers["authorization"] == "Bearer vercel_blob_rw_teststore_dummy"
        assert request.headers["x-vercel-blob-access"] == "public"
        assert request.headers["x-vercel-blob-store-id"] == "teststore"
        assert request.headers["x-allow-overwrite"] == "0"
        assert request.headers["x-api-version"] == "13"
        assert request.content.startswith(b"\xff\xd8")
        calls.append(request)
        return httpx.Response(200, json={
            "url": "https://teststore.public.blob.vercel-storage.com/" + pathname,
            "pathname": pathname, "contentType": "image/jpeg",
        })

    mock_blob_transport(monkeypatch, provider)
    response = client.post("/api/v1/media", headers=auth,
                           files={"file": ("../../unsafe.png", image_bytes(), "image/png")})
    assert response.status_code == 201
    assert response.json()["url"].startswith("https://teststore.public.blob.vercel-storage.com/")
    assert len(calls) == 1
    assert client.get("/health").json()["media"] == "vercel_blob"
    assert "dummy" not in response.text


@pytest.mark.parametrize("failure", ["denied", "timeout", "private_url", "bad_json", "redirect"])
def test_blob_failures_are_clear_503_and_never_use_local_storage(api, monkeypatch, failure):
    import app.media as media

    client, factory, password = api
    auth = login(client, password)
    config = client.app.state.config
    config.app_env = "production"
    config.blob_read_write_token = SecretStr("vercel_blob_rw_teststore_dummy")

    class NoLocalStorage:
        def __truediv__(self, path):
            raise AssertionError("Production Blob failure must not write local files.")

    monkeypatch.setattr(media, "ROOT", NoLocalStorage())

    def provider(request):
        if failure == "timeout":
            raise httpx.ConnectTimeout("provider-internal-secret", request=request)
        if failure == "denied":
            return httpx.Response(403, json={"error": "provider-internal-secret"})
        if failure == "bad_json":
            return httpx.Response(200, text="provider-internal-secret")
        if failure == "redirect":
            return httpx.Response(307, headers={"Location": "https://untrusted.example"})
        return httpx.Response(200, json={
            "url": "https://teststore.private.blob.vercel-storage.com/secret.jpg",
            "pathname": request.url.params["pathname"],
        })

    mock_blob_transport(monkeypatch, provider)
    response = client.post("/api/v1/media", headers=auth,
                           files={"file": ("safe.png", image_bytes(), "image/png")})
    assert response.status_code == 503
    assert response.json()["code"] == "media_storage_unavailable"
    assert "provider-internal-secret" not in response.text
    assert "dummy" not in response.text


def test_invalid_image_never_reaches_blob_provider(api, monkeypatch):
    client, factory, password = api
    auth = login(client, password)
    client.app.state.config.blob_read_write_token = SecretStr("vercel_blob_rw_teststore_dummy")

    def provider(request):
        pytest.fail("Invalid image must be rejected before external upload.")

    mock_blob_transport(monkeypatch, provider)
    response = client.post("/api/v1/media", headers=auth,
                           files={"file": ("pretend.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 422
