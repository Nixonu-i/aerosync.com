from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import random
from datetime import timedelta
from django.utils import timezone
import base64
from email.mime.text import MIMEText
import google.auth.transport.requests as google_requests
from google.oauth2 import credentials as google_credentials
from googleapiclient.discovery import build


class EmailVerificationService:
    """Service for sending email verification codes using Gmail OAuth 2.0"""
    
    @staticmethod
    def _get_gmail_credentials():
        """Get authenticated Gmail API credentials"""
        try:
            # Load OAuth credentials from settings
            cred = google_credentials.Credentials(
                token=None,
                refresh_token=settings.GMAIL_OAUTH_REFRESH_TOKEN,
                client_id=settings.GMAIL_OAUTH_CLIENT_ID,
                client_secret=settings.GMAIL_OAUTH_CLIENT_SECRET,
                token_uri=settings.GMAIL_OAUTH_TOKEN_URI,
            )
            
            # Refresh the access token
            cred.refresh(google_requests.Request())
            
            return cred
        except Exception as e:
            raise Exception(f"Failed to authenticate with Gmail OAuth: {str(e)}")
    
    @staticmethod
    def _send_email_via_gmail(to_email, subject, html_content, text_content):
        """Send email using Gmail API with OAuth 2.0"""
        try:
            # Get authenticated credentials
            creds = EmailVerificationService._get_gmail_credentials()
            
            # Build Gmail API service
            service = build('gmail', 'v1', credentials=creds)
            
            # Create MIME message
            message = MIMEText(html_content, 'html', 'utf-8')
            message['to'] = to_email
            message['from'] = settings.GMAIL_SENDER_EMAIL
            message['subject'] = subject
            
            # Encode the message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            # Send the message
            send_message = {
                'raw': raw_message
            }
            
            result = service.users().messages().send(
                userId='me',
                body=send_message
            ).execute()
            
            print(f"Email sent successfully! Message ID: {result['id']}")
            return True
            
        except Exception as e:
            print(f"Error sending email via Gmail: {str(e)}")
            # Fallback to Django's default email backend if Gmail API fails
            print("Falling back to SMTP...")
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[to_email]
            )
            msg.attach_alternative(html_content, "text/html")
            msg.send()
            return True
    
    @staticmethod
    def generate_verification_code():
        """Generate a random 6-digit verification code"""
        return ''.join([str(random.randint(0, 9)) for _ in range(6)])
    
    @staticmethod
    def send_verification_email(user):
        """
        Generate and send verification email to user using Gmail OAuth
        Returns the verification code (for testing purposes)
        """
        # Generate verification code
        code = EmailVerificationService.generate_verification_code()
        
        # Save code to user model
        user.email_verification_code = code
        user.email_verification_created_at = timezone.now()
        user.save(update_fields=['email_verification_code', 'email_verification_created_at'])
        
        # Prepare email content
        subject = 'Verify Your Email - AeroSync'
        
        # HTML content
        html_content = render_to_string('emails/email_verification.html', {
            'user': user,
            'code': code,
            'expiry_minutes': getattr(settings, 'EMAIL_VERIFICATION_EXPIRY_MINUTES', 15)
        })
        
        # Plain text content
        text_content = f"""
Hello {user.first_name or user.username},

Your email verification code for AeroSync is: {code}

This code will expire in {getattr(settings, 'EMAIL_VERIFICATION_EXPIRY_MINUTES', 15)} minutes.

If you didn't request this code, please ignore this email.

Best regards,
The AeroSync Team
"""
        
        # Send email using Gmail API with OAuth 2.0
        EmailVerificationService._send_email_via_gmail(
            to_email=user.email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
        
        return code
    
    @staticmethod
    def verify_code(user, code):
        """
        Verify if the provided code matches and is not expired
        Returns True if valid, False otherwise
        """
        if not user.email_verification_code:
            return False
        
        # Check if code matches
        if user.email_verification_code != code:
            return False
        
        # Check if code is expired (default: 15 minutes)
        expiry_minutes = getattr(settings, 'EMAIL_VERIFICATION_EXPIRY_MINUTES', 15)
        if user.email_verification_created_at:
            expiry_time = user.email_verification_created_at + timedelta(minutes=expiry_minutes)
            if timezone.now() > expiry_time:
                # Code expired
                return False
        
        # Mark email as verified
        user.is_email_verified = True
        user.email_verification_code = None  # Clear used code
        user.email_verification_created_at = None
        user.save(update_fields=['is_email_verified', 'email_verification_code', 'email_verification_created_at'])
        
        return True
    
    @staticmethod
    def resend_verification(user):
        """Resend verification email with new code"""
        return EmailVerificationService.send_verification_email(user)
    
    @staticmethod
    def send_password_reset_email(user):
        """
        Send password reset OTP code to user's email
        Returns the code for testing purposes
        """
        from django.conf import settings
        
        # Generate a 6-digit code
        code = EmailVerificationService.generate_verification_code()
        
        # Store the code with timestamp
        user.password_reset_code = code
        user.password_reset_created_at = timezone.now()
        user.save(update_fields=['password_reset_code', 'password_reset_created_at'])
        
        # Prepare email content
        subject = "Password Reset Request - AeroSync"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #20c997;">Password Reset Request</h2>
                <p>Hello {user.username or user.email},</p>
                <p>You requested to reset your password. Use the following One-Time Passcode (OTP):</p>
                <div style="background-color: #f4f4f4; padding: 15px; border-left: 4px solid #20c997; margin: 20px 0;">
                    <strong style="font-size: 24px; letter-spacing: 5px;">{code}</strong>
                </div>
                <p>This code will expire in <strong>15 minutes</strong>.</p>
                <p>If you didn't request this password reset, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">© 2024 AeroSync. All rights reserved.</p>
            </div>
        </body>
        </html>
        """
        text_content = f"""Hello {user.username or user.email},
        
You requested to reset your password. Use the following One-Time Passcode (OTP): {code}

This code will expire in 15 minutes.

If you didn't request this password reset, please ignore this email.

© 2024 AeroSync. All rights reserved.
        """
        
        # Send the email
        EmailVerificationService._send_email_via_gmail(
            to_email=user.email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
        
        print(f'🔐 Password reset code sent to {user.email}: {code}')
        return code
    
    @staticmethod
    def verify_password_reset_code(user, code):
        """
        Verify password reset OTP code
        Returns True if valid, False otherwise
        """
        if not user.password_reset_code:
            return False
        
        # Check if code matches
        if user.password_reset_code != code:
            return False
        
        # Check if code is expired (default: 15 minutes)
        expiry_minutes = getattr(settings, 'EMAIL_VERIFICATION_EXPIRY_MINUTES', 15)
        if user.password_reset_created_at:
            expiry_time = user.password_reset_created_at + timedelta(minutes=expiry_minutes)
            if timezone.now() > expiry_time:
                # Code expired
                return False
        
        # Clear the used code
        user.password_reset_code = None
        user.password_reset_created_at = None
        user.save(update_fields=['password_reset_code', 'password_reset_created_at'])
        
        return True
