import requests
from django.conf import settings
from django.core.cache import cache
from datetime import timedelta
from urllib.parse import quote


class PesapalService:
    """
    Pesapal Payment Gateway Service
    
    Handles all interactions with Pesapal API v3:
    - Authentication (get access token)
    - Submit order
    - Check transaction status
    - Handle IPN callbacks
    """
    
    def __init__(self):
        self.consumer_key = settings.PESAPAL_CONSUMER_KEY
        self.consumer_secret = settings.PESAPAL_CONSUMER_SECRET
        self.environment = settings.PESAPAL_ENVIRONMENT
        self.base_url = settings.PESAPAL_API_URLS.get(self.environment, settings.PESAPAL_API_URLS['sandbox'])
        self.callback_url = settings.PESAPAL_CALLBACK_URL
        self.ipn_url = settings.PESAPAL_IPN_URL
        
        # Token cache key and expiry
        self.TOKEN_CACHE_KEY = 'pesapal_access_token'
        self.TOKEN_EXPIRY_SECONDS = 3400  # Token expires in 1 hour, refresh at 57 minutes
        
        # IPN ID cache - stores the registered IPN ID
        self.IPN_CACHE_KEY = 'pesapal_ipn_id'
    
    def get_access_token(self):
        """
        Get or refresh Pesapal access token
        Token is cached for 57 minutes to avoid unnecessary API calls
        """
        # Try to get from cache first
        token = cache.get(self.TOKEN_CACHE_KEY)
        if token:
            return token
        
        # Request new token - Pesapal expects JSON payload
        url = f"{self.base_url}/api/auth/RequestToken"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Pesapal expects these exact parameter names in JSON
        payload = {
            "consumer_key": self.consumer_key,
            "consumer_secret": self.consumer_secret
        }
        
        try:
            print(f"🔵 Requesting token from: {url}")
            print(f"🔵 Consumer Key: {self.consumer_key[:20]}...")  # Show first 20 chars only
            print(f"🔵 Environment: {self.environment}")
            print(f"🔵 Base URL: {self.base_url}")
            print(f"🔵 Sending JSON payload")
            
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            
            print(f"🔵 Response status: {response.status_code}")
            print(f"🔵 Response body: {response.text[:200]}")  # First 200 chars
            
            if response.status_code == 401:
                print(f"❌ Authentication failed - check consumer key and secret!")
                print(f"❌ Key length: {len(self.consumer_key)}, Secret length: {len(self.consumer_secret)}")
                raise Exception("Pesapal authentication failed: Invalid credentials (401)")
            
            response.raise_for_status()
            
            data = response.json()
            token = data.get('token')
            
            if not token:
                raise Exception(f"Pesapal API did not return access token. Response: {data}")
            
            # Cache the token
            cache.set(self.TOKEN_CACHE_KEY, token, self.TOKEN_EXPIRY_SECONDS)
            
            print(f"✅ Pesapal: New access token obtained")
            return token
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Pesapal authentication failed: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"❌ Response content: {e.response.text}")
            raise Exception(f"Pesapal authentication failed: {str(e)}")
    
    def register_ipn_url(self):
        """
        Register IPN URL with Pesapal and get the IPN ID
        This must be done before submitting orders
        """
        # Try to get from cache first
        ipn_id = cache.get(self.IPN_CACHE_KEY)
        if ipn_id:
            print(f"✅ Using cached IPN ID: {ipn_id}")
            return ipn_id
        
        # Register the IPN URL
        token = self.get_access_token()
        url = f"{self.base_url}/api/URLSetup/RegisterIPN"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {token}"
        }
        
        payload = {
            "url": self.ipn_url,
            "ipn_notification_type": "POST"
        }
        
        try:
            print(f"🔵 Registering IPN URL: {self.ipn_url}")
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            print(f"🔵 IPN Registration response: {data}")
            
            if data.get('error'):
                raise Exception(f"Pesapal IPN registration error: {data.get('error')}")
            
            ipn_id = data.get('ipn_id')
            ipn_status = data.get('ipn_status_description', 'Unknown')
            
            if not ipn_id:
                raise Exception(f"Pesapal did not return IPN ID. Response: {data}")
            
            # Cache the IPN ID (long-term cache)
            cache.set(self.IPN_CACHE_KEY, ipn_id, 86400 * 30)  # Cache for 30 days
            
            print(f"✅ IPN URL registered successfully! ID: {ipn_id}, Status: {ipn_status}")
            return ipn_id
            
        except requests.exceptions.RequestException as e:
            print(f"❌ IPN registration failed: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"❌ Response content: {e.response.text}")
            raise Exception(f"IPN registration failed: {str(e)}")
    
    def submit_order(self, order_details):
        """
        Submit order to Pesapal and get payment iframe URL
        
        Args:
            order_details: dict containing:
                - amount: decimal
                - currency: str (e.g., 'KES', 'USD')
                - description: str
                - merchant_reference: str (unique order ID)
                - billing_email: str
                - billing_phone: str (optional)
                - callback_url: str (optional, overrides default)
        
        Returns:
            dict with:
                - redirect_url: URL to redirect user to Pesapal iframe
                - order_tracking_id: Pesapal order ID
                - merchant_reference: Your reference
        """
        token = self.get_access_token()
        
        # Register IPN URL first (required by Pesapal V3)
        ipn_id = self.register_ipn_url()
        
        url = f"{self.base_url}/api/Transactions/SubmitOrderRequest"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {token}"
        }
        
        # Build order request payload - matching Pesapal V3 API spec exactly
        payload = {
            "id": order_details.get('merchant_reference'),
            "currency": order_details.get('currency', 'KES'),
            "amount": float(order_details.get('amount', 0)),
            "description": order_details.get('description', 'Flight Booking Payment'),
            "callback_url": order_details.get('callback_url', self.callback_url),
            "notification_id": ipn_id,
            "billing_address": {
                "email_address": order_details.get('billing_email'),
                "phone_number": order_details.get('billing_phone', ''),
                "country_code": "KE",
                "first_name": order_details.get('first_name', ''),
                "last_name": order_details.get('last_name', ''),
                "line_1": order_details.get('address_line1', 'N/A'),
                "line_2": order_details.get('address_line2', ''),
                "city": order_details.get('city', 'Nairobi'),
                "state": order_details.get('state', ''),
                "postal_code": order_details.get('postal_code', '00100')
            }
        }
        
        # Debug log - show exact JSON being sent
        import json
        print(f"🔵 Pesapal payload JSON: {json.dumps(payload, indent=2)}")
        
        # Debug log
        print(f"🔵 Pesapal payload: {payload}")
        
        try:
            print(f"🔵 Submitting order to: {url}")
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            
            print(f"🔵 Response status: {response.status_code}")
            print(f"🔵 Response body: {response.text[:300]}")  # First 300 chars
            
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('error'):
                print(f"❌ Pesapal error response: {data.get('error')}")
                raise Exception(f"Pesapal error: {data.get('error')}")
            
            redirect_url = data.get('redirect_url')
            order_tracking_id = data.get('order_tracking_id')
            
            if not redirect_url or not order_tracking_id:
                raise Exception("Pesapal did not return redirect URL or tracking ID")
            
            print(f"✅ Pesapal order submitted: {order_tracking_id}")
            
            return {
                'redirect_url': redirect_url,
                'order_tracking_id': order_tracking_id,
                'merchant_reference': order_details.get('merchant_reference')
            }
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Pesapal order submission failed: {str(e)}")
            raise Exception(f"Pesapal order submission failed: {str(e)}")
    
    def check_transaction_status(self, order_tracking_id):
        """
        Check the status of a Pesapal transaction
        
        Args:
            order_tracking_id: Pesapal order tracking ID
        
        Returns:
            dict with:
                - status: transaction status (COMPLETE, FAILED, etc.)
                - payment_method: payment method used
                - confirmation_code: payment confirmation code
        """
        token = self.get_access_token()
        
        url = f"{self.base_url}/api/Transactions/GetTransactionStatus?orderTrackingId={order_tracking_id}"
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {token}"
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            return {
                'status': data.get('payment_status_description', 'UNKNOWN'),
                'status_code': data.get('status_code', ''),  # 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED
                'payment_method': data.get('payment_method', ''),
                'confirmation_code': data.get('confirmation_code', ''),
                'transaction_type': data.get('transaction_type', ''),
                'amount': data.get('amount', 0),
                'payment_account': data.get('payment_account', ''),  # Masked card/phone
                'created_date': data.get('created_date', ''),
                'description': data.get('description', ''),
                'currency': data.get('currency', '')
            }
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Pesapal status check failed: {str(e)}")
            raise Exception(f"Pesapal status check failed: {str(e)}")
    
    @staticmethod
    def parse_ipn_notification(notification_data):
        """
        Parse IPN (Instant Payment Notification) data from Pesapal
        
        Args:
            notification_data: POST data from Pesapal IPN callback
        
        Returns:
            dict with parsed notification details
        """
        return {
            'order_tracking_id': notification_data.get('OrderTrackingId'),
            'order_merchant_reference': notification_data.get('OrderMerchantReference'),
            'notification_type': notification_data.get('NotificationType'),  # COMPLETED, FAILED, etc.
            'payment_status_description': notification_data.get('PaymentStatusDescription'),
            'payment_method': notification_data.get('PaymentMethod'),
            'confirmation_code': notification_data.get('ConfirmationCode'),
            'transaction_type': notification_data.get('TransactionType')
        }
