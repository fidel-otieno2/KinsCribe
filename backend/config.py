import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///kinscribe.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-dev-secret")
    JWT_ACCESS_TOKEN_EXPIRES = 3600
    JWT_REFRESH_TOKEN_EXPIRES = 2592000
    JWT_IDENTITY_CLAIM = "sub"

    MAIL_SERVER = os.getenv("MAIL_SERVER")
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER")

    CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
    CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
    CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
