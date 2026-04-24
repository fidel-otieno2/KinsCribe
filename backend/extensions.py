from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_mail import Mail
from flask_cors import CORS

db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()
mail = Mail()
cors = CORS()


def utc_iso(dt):
    """Always return UTC timestamp with Z suffix so JavaScript parses it correctly."""
    if dt is None:
        return None
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')
