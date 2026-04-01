from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import os
import random
from datetime import timedelta
from django.utils import timezone
import sib_api_v3_sdk


class EmailVerificationService:
    """Service for sending email verification codes using Brevo Transactional Email API"""
    
    @staticmethod
    def _get_brevo_api_instance():
        """Get authenticated Brevo API instance"""
        api_key = settings.BREVO_API_KEY
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        return sib_api_v3_sdk.TransactionalEmailsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )
    
    @staticmethod
    def _send_email(to_email, subject, html_content, text_content):
        """Send email using configured backend (Brevo or Gmail OAuth)"""
        try:
            # Check if Brevo is configured
            brevo_key = os.getenv('BREVO_API_KEY', '')
            if brevo_key and brevo_key != 'xkeysib-your-api-key-here':
                # Use Brevo API
                api_instance = EmailVerificationService._get_brevo_api_instance()
                    
                sender = {"name": "AeroSync", "email": settings.DEFAULT_FROM_EMAIL.split('<')[1].strip('>')}  
                to = [{"email": to_email}]
                    
                send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                    to=to,
                    html_content=html_content,
                    text_content=text_content,
                    sender=sender,
                    subject=subject
                )
                    
                response = api_instance.send_transac_email(send_smtp_email)
                print(f"Email sent successfully via Brevo! Message ID: {response.message_id}")
                return True
            else:
                # Use Django's configured email backend (Gmail OAuth)
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=text_content,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[to_email]
                )
                msg.attach_alternative(html_content, "text/html")
                msg.send()
                print(f"Email sent successfully via Gmail!")
                return True
        except sib_api_v3_sdk.rest.ApiException as e:
            # Handle Brevo API errors specifically
            import logging
            logger = logging.getLogger('email_service')
                
            if e.status == 401 and 'unrecognised IP address' in str(e.body):
                logger.error(f'Brevo IP authorization failed (105.160.78.41). Add IP at https://app.brevo.com/security/authorised_ips')
                # Re-raise with clearer message for views to handle
                raise Exception('Email service IP not authorized in Brevo')
            else:
                logger.error(f'Brevo API error: {e}')
                raise
        except Exception as e:
            print(f"Error sending email: {str(e)}")
            raise
    
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
        
        # Send email using configured backend (Brevo or Gmail)
        EmailVerificationService._send_email(
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
        
        # Prepare email content with matching design from verification template
        subject = "Password Reset Request - AeroSync"
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset Request - AeroSync</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
                            
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #0b1220 0%, #1a2744 100%); padding: 40px 30px; text-align: center;">
                                    <h1 style="color: #d4af37; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 2px;">
                                        AEROSYNC
                                    </h1>
                                    <p style="color: rgba(255,255,255,0.7); margin: 10px 0 0 0; font-size: 14px;">
                                        Flight Booking System
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <h2 style="color: #0b1220; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">
                                        Password Reset Request
                                    </h2>
                                    
                                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                        Hello {user.username or user.email},
                                    </p>
                                    
                                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                        You requested to reset your password. Use the following One-Time Passcode (OTP):
                                    </p>
                                    
                                    <!-- Verification Code Box -->
                                    <table role="presentation" style="width: 100%; margin: 30px 0; background-color: #f8f9fa; border-left: 4px solid #d4af37; border-radius: 4px;">
                                        <tr>
                                            <td align="center" style="padding: 30px;">
                                                <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">
                                                    Your Reset Code
                                                </p>
                                                <div style="font-size: 36px; font-weight: 700; color: #d4af37; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                                    {code}
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <p style="color: #333333; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                                        This code will expire in <strong>15 minutes</strong>.
                                    </p>
                                    
                                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                                        If you didn't request this password reset, please ignore this email.
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                                    <p style="color: #666666; font-size: 13px; margin: 0 0 10px 0;">
                                        Need help? Contact our support team at 
                                        <a href="mailto:support@aerosync.com" style="color: #d4af37; text-decoration: none;">support@aerosync.com</a>
                                    </p>
                                    <p style="color: #999999; font-size: 12px; margin: 10px 0 0 0;">
                                        © 2024 AeroSync. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                            
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        text_content = f"""Hello {user.username or user.email},
        
You requested to reset your password. Use the following One-Time Passcode (OTP): {code}

This code will expire in 15 minutes.

If you didn't request this password reset, please ignore this email.

© 2024 AeroSync. All rights reserved.
        """
        
        # Send the email using configured backend (Brevo or Gmail)
        EmailVerificationService._send_email(
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
