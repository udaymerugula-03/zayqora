"""Independent transactional SMTP outbox worker. Never logs message bodies/tokens."""
import argparse
import smtplib
import ssl
import time
from datetime import timedelta
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from .config import settings
from .db import make_engine
from .models import Outbox, now


def deliver_batch(factory, config):
    sent = 0
    with factory() as db:
        messages = list(db.scalars(select(Outbox).where(
            Outbox.status == "pending", Outbox.available_at <= now())
            .order_by(Outbox.created_at).limit(10).with_for_update(skip_locked=True)))
        for item in messages:
            message = EmailMessage()
            message["From"] = config.smtp_from
            message["To"] = item.recipient
            message["Subject"] = item.subject
            message["Message-ID"] = f"<{item.id}@zayqora.outbox>"
            message.set_content(item.body)
            try:
                with smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=20) as smtp:
                    if config.smtp_starttls:
                        smtp.starttls(context=ssl.create_default_context())
                    if config.smtp_username:
                        smtp.login(config.smtp_username, config.smtp_password)
                    smtp.send_message(message)
                item.status = "sent"
                item.body = "[delivered]"
                sent += 1
            except (OSError, smtplib.SMTPException):
                item.attempts += 1
                item.available_at = now() + timedelta(seconds=min(3600, 30 * 2 ** min(item.attempts, 7)))
                if item.attempts >= 10:
                    item.status = "failed"
        db.commit()
    return sent


def main():
    parser = argparse.ArgumentParser(description="Deliver queued ZAYQORA email through real SMTP.")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    config = settings()
    config.validate_runtime()
    if not config.smtp_configured:
        raise SystemExit("SMTP_HOST and SMTP_FROM are required. No messages have been sent.")
    factory = sessionmaker(make_engine(config.database_url), expire_on_commit=False)
    while True:
        deliver_batch(factory, config)
        if args.once:
            break
        time.sleep(5)


if __name__ == "__main__":
    main()
