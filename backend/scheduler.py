from apscheduler.schedulers.background import BackgroundScheduler
import logging

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def start_scheduler(app):
    """Start the background scheduler for event reminders"""
    from services.event_reminder_service import send_event_reminders, check_daily_events
    
    def run_with_context(func):
        """Wrapper to run function with Flask app context"""
        def wrapper():
            with app.app_context():
                try:
                    func()
                except Exception as e:
                    logger.error(f"Scheduler task error: {e}")
        return wrapper
    
    # Check for upcoming events every 15 minutes
    scheduler.add_job(
        func=run_with_context(send_event_reminders),
        trigger="interval",
        minutes=15,
        id="event_reminders",
        name="Send event reminders",
        replace_existing=True
    )
    
    # Send daily event digest at 8 AM
    scheduler.add_job(
        func=run_with_context(check_daily_events),
        trigger="cron",
        hour=8,
        minute=0,
        id="daily_events",
        name="Daily events digest",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Event reminder scheduler started")


def stop_scheduler():
    """Stop the scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Event reminder scheduler stopped")
