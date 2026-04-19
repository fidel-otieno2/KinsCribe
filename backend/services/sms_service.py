import os
from twilio.rest import Client
from twilio.base.exceptions import TwilioException

class SMSService:
    def __init__(self):
        self.account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.from_number = os.getenv('TWILIO_PHONE_NUMBER')
        
        if self.account_sid and self.auth_token and self.from_number:
            self.client = Client(self.account_sid, self.auth_token)
            self.enabled = True
        else:
            self.client = None
            self.enabled = False
            print("⚠️  SMS Service disabled - Twilio credentials not configured")
    
    def send_otp(self, phone_number, otp_code):
        """
        Send OTP code via SMS
        
        Args:
            phone_number (str): International format phone number (+254729569010)
            otp_code (str): 6-digit OTP code
            
        Returns:
            dict: Success/error response
        """
        if not self.enabled:
            return {
                'success': False,
                'error': 'SMS service not configured',
                'dev_otp': otp_code  # Return OTP for development
            }
        
        try:
            message_body = f"Your KinsCribe verification code is: {otp_code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this message."
            
            message = self.client.messages.create(
                body=message_body,
                from_=self.from_number,
                to=phone_number
            )
            
            print(f"📱 SMS sent successfully to {phone_number}: {message.sid}")
            
            return {
                'success': True,
                'message_sid': message.sid,
                'status': message.status
            }
            
        except TwilioException as e:
            print(f"❌ Twilio SMS error: {e}")
            return {
                'success': False,
                'error': str(e),
                'dev_otp': otp_code  # Fallback for development
            }
        except Exception as e:
            print(f"❌ SMS service error: {e}")
            return {
                'success': False,
                'error': 'Failed to send SMS',
                'dev_otp': otp_code  # Fallback for development
            }
    
    def send_welcome_sms(self, phone_number, name):
        """Send welcome SMS to new users"""
        if not self.enabled:
            return {'success': False, 'error': 'SMS service not configured'}
        
        try:
            message_body = f"Welcome to KinsCribe, {name}! 🎉\n\nYour account has been created successfully. Start capturing and sharing your family memories today!\n\nDownload the app: kinscribe.com"
            
            message = self.client.messages.create(
                body=message_body,
                from_=self.from_number,
                to=phone_number
            )
            
            return {'success': True, 'message_sid': message.sid}
            
        except Exception as e:
            print(f"❌ Welcome SMS error: {e}")
            return {'success': False, 'error': str(e)}

# Global SMS service instance
sms_service = SMSService()