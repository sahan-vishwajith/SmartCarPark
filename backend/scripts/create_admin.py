"""
Create (or reset password for) an admin user.

Usage (from the `backend` directory, with your venv active):

    python -m scripts.create_admin --username admin --password "Strong!Pass1" --full-name "Site Admin" --email admin@example.com

If an admin with that username already exists, the password is reset.
This script also creates the `admins` and `payments` tables in the
database if they do not yet exist (db.create_all on the Admin/Payment models).
"""
from __future__ import annotations

import argparse
import sys

from werkzeug.security import generate_password_hash

# Local imports work when run as `python -m scripts.create_admin` from /backend
from app import create_app
from app.extensions import db
from app.models import Admin, Payment  # noqa: F401  (ensures tables registered)


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or reset an admin user.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--full-name", default=None)
    parser.add_argument("--email", default=None)
    parser.add_argument("--role", default="super", choices=["super", "staff"])
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        # Make sure new tables exist (admins, payments)
        db.create_all()

        admin = db.session.query(Admin).filter_by(username=args.username).first()
        if admin is None:
            admin = Admin(
                username=args.username,
                password_hash=generate_password_hash(args.password),
                full_name=args.full_name,
                email=args.email,
                role=args.role,
                is_active=True,
            )
            db.session.add(admin)
            db.session.commit()
            print(f"Created admin id={admin.id} username={admin.username} role={admin.role}")
        else:
            admin.password_hash = generate_password_hash(args.password)
            if args.full_name is not None:
                admin.full_name = args.full_name
            if args.email is not None:
                admin.email = args.email
            admin.role = args.role
            admin.is_active = True
            db.session.commit()
            print(f"Updated admin id={admin.id} username={admin.username} (password reset)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
