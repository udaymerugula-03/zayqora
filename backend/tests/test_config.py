import pytest

from app.config import ROOT, Settings


def test_root_env_path_and_process_environment_override(monkeypatch):
    assert Settings.model_config["env_file"] == str(ROOT / ".env")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:unused@localhost/isolated")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("PUBLIC_ORIGIN", "http://localhost:3000")
    monkeypatch.setenv("APP_ENV", "development")
    config = Settings()
    assert config.database_url == "postgresql+psycopg://user:unused@localhost/isolated"
    assert config.public_web_url == "http://localhost:3000"
    assert config.cors_origins == "http://localhost:3000"
    config.validate_runtime()


def test_production_requires_https_origins():
    config = Settings(_env_file=None, database_url="postgresql://localhost/isolated",
                      secret_key="a" * 32, app_env="production",
                      public_web_url="http://localhost:3000",
                      cors_origins="http://localhost:3000")
    with pytest.raises(RuntimeError, match="HTTPS"):
        config.validate_runtime()
    config.public_web_url = "https://zayqora.example"
    config.cors_origins = "https://zayqora.example"
    config.validate_runtime()


def test_verified_postgres_tls_uses_trusted_ca_without_overriding_explicit_roots(monkeypatch):
    import certifi
    import app.db as db_module

    calls = []
    monkeypatch.delenv("PGSSLROOTCERT", raising=False)
    monkeypatch.setattr(db_module, "create_engine", lambda *args, **kwargs: calls.append(kwargs))
    url = "postgresql+psycopg://user:unused@localhost/isolated?sslmode=verify-full"
    db_module.make_engine(url)
    assert calls[-1]["connect_args"]["sslrootcert"] == certifi.where()
    db_module.make_engine(url + "&sslrootcert=provider-root.pem")
    assert calls[-1]["connect_args"] == {}
    monkeypatch.setenv("PGSSLROOTCERT", "operator-root.pem")
    db_module.make_engine(url)
    assert calls[-1]["connect_args"] == {}
