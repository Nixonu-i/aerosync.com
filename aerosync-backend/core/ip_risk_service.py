"""
IP Risk Score checking service using Fraudlogix API
"""
import requests
import logging
import os
import ipaddress
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)

FRAUDLOGIX_API_URL = "https://iplist.fraudlogix.com/v5"
FRAUDLOGIX_API_KEY = os.environ.get('FRAUDLOGIX_API_KEY', '')
CACHE_TIMEOUT = 3600  # Cache results for 1 hour

if not FRAUDLOGIX_API_KEY:
    logger.warning('FRAUDLOGIX_API_KEY not set in environment variables')


def is_private_ip(ip_address: str) -> bool:
    """Check if IP is a private/local address"""
    try:
        ip = ipaddress.ip_address(ip_address)
        return ip.is_private or ip.is_loopback or ip.is_reserved
    except ValueError:
        return False


def check_ip_risk(ip_address: str) -> dict:
    """
    Check IP risk score using Fraudlogix API
    
    Args:
        ip_address: IP address to check
        
    Returns:
        dict with risk information
    """
    if not ip_address:
        return {
            'risk_score': 'Unknown',
            'blocked': False,
            'reason': 'No IP provided'
        }
    
    # Allow localhost and private IP addresses (development/testing)
    if is_private_ip(ip_address):
        return {
            'ip': ip_address,
            'risk_score': 'Low',
            'recently_seen': 0,
            'blocked': False,
            'block_reason': None,
            'tor': False,
            'vpn': False,
            'proxy': False,
            'datacenter': False,
            'masked_devices': False,
            'country': 'Local Network',
            'country_code': '',
            'isp': 'Local Network',
            'organization': 'Local Network',
            'connection_type': 'Local',
            'raw_data': {}
        }
    
    # Check cache first
    cache_key = f'ip_risk_{ip_address}'
    cached_result = cache.get(cache_key)
    if cached_result:
        return cached_result
    
    try:
        headers = {
            'x-api-key': FRAUDLOGIX_API_KEY,
            'Content-Type': 'application/json'
        }
        
        response = requests.get(
            FRAUDLOGIX_API_URL,
            params={'ip': ip_address},
            headers=headers,
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Determine if IP should be blocked
            risk_score = data.get('RiskScore', 'Unknown')
            using_tor = data.get('TOR', False)
            using_vpn = data.get('VPN', False)
            using_proxy = data.get('Proxy', False)
            
            # Block if risk is High/Extreme, using TOR, VPN, or Proxy
            blocked = (
                risk_score in ['High', 'Extreme'] or 
                using_tor or 
                using_vpn or 
                using_proxy
            )
            
            result = {
                'ip': ip_address,
                'risk_score': risk_score,
                'recently_seen': data.get('RecentlySeen', 0),
                'blocked': blocked,
                'block_reason': (
                    f'{risk_score} risk score' if risk_score in ['High', 'Extreme'] else 
                    'TOR usage detected' if using_tor else 
                    'VPN usage detected' if using_vpn else 
                    'Proxy usage detected' if using_proxy else
                    None
                ),
                'tor': using_tor,
                'vpn': using_vpn,
                'proxy': using_proxy,
                'country': data.get('Country', ''),
                'country_code': data.get('CountryCode', ''),
                'datacenter': data.get('DataCenter', False),
                'masked_devices': data.get('MaskedDevices', False),
                'isp': data.get('ISP', ''),
                'organization': data.get('Organization', ''),
                'connection_type': data.get('ConnectionType', ''),
                'raw_data': data
            }
            
            # Cache the result
            cache.set(cache_key, result, CACHE_TIMEOUT)
            
            logger.info(f"IP Risk Check - IP: {ip_address}, Risk: {risk_score}, Blocked: {blocked}")
            
            return result
        else:
            logger.error(f"Fraudlogix API error: {response.status_code}")
            return {
                'ip': ip_address,
                'risk_score': 'Unknown',
                'blocked': False,
                'reason': 'API error'
            }
            
    except requests.exceptions.Timeout:
        logger.error(f"Fraudlogix API timeout for IP: {ip_address}")
        return {
            'ip': ip_address,
            'risk_score': 'Unknown',
            'blocked': False,
            'reason': 'API timeout'
        }
    except requests.exceptions.RequestException as e:
        logger.error(f"Fraudlogix API error for IP: {ip_address}: {str(e)}")
        return {
            'ip': ip_address,
            'risk_score': 'Unknown',
            'blocked': False,
            'reason': f'API error: {str(e)}'
        }
