from flask import Flask
from config import Config
from extensions import db, jwt, bcrypt, mail, cors

from routes.auth_routes import auth_bp
from routes.family_routes import family_bp
from routes.story_routes import story_bp
from routes.storybook_routes import storybook_bp
from routes.ai_routes import ai_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(family_bp, url_prefix="/api/family")
    app.register_blueprint(story_bp, url_prefix="/api/stories")
    app.register_blueprint(storybook_bp, url_prefix="/api/storybooks")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")

    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
