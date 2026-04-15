"""
Supabase JWT authentication helpers.

Flow:
  1. Frontend signs in via supabase.auth.signInWithPassword()
  2. Supabase returns a JWT signed with ECC (P-256) / ES256
  3. Frontend sends Authorization: Bearer <jwt> on every GraphQL request
  4. get_user_from_request() decodes the JWT and looks up CustomUser by supabase_id
  5. get_tenant_from_user() returns user.active_tenant (with fallback)

Key rotation note:
  Supabase now uses ECC (P-256) as the current key (ES256 algorithm).
  We verify via JWKS (public key endpoint) — no shared secret needed.
  Legacy HS256 secret is kept as fallback for tokens issued before rotation.
"""

import logging
import threading
import time

import jwt
from django.conf import settings
from django.db import IntegrityError

from core.models import Tenant
from users.models import CustomUser

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# PyJWKClient cache — reuse across requests, refresh every hour
# ────────────────────────────────────────────────────────────────────────────

_jwks_client = None
_jwks_client_lock = threading.Lock()
_jwks_client_created_at: float = 0
_JWKS_TTL = 3600  # 1 hour


def _get_jwks_client():
    global _jwks_client, _jwks_client_created_at
    now = time.time()
    with _jwks_client_lock:
        if _jwks_client is None or (now - _jwks_client_created_at) > _JWKS_TTL:
            from jwt import PyJWKClient
            url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
            _jwks_client = PyJWKClient(url, cache_keys=True, lifespan=_JWKS_TTL)
            _jwks_client_created_at = now
            logger.debug(f"JWKS client initialized for {url}")
    return _jwks_client


def decode_jwt(token: str) -> dict:
    """
    Decode a Supabase JWT.

    Primary:  ES256 via JWKS (current Supabase key is ECC P-256)
    Fallback: HS256 via SUPABASE_JWT_SECRET (legacy, for tokens issued before rotation)
    """
    errors = []

    # ── Primary: ECC / ES256 via JWKS ───────────────────────────────────────
    if settings.SUPABASE_URL:
        try:
            client = _get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=['ES256', 'RS256'],
                options={'verify_aud': False},
            )
        except Exception as e:
            errors.append(f"JWKS/ES256 failed: {e}")
            logger.warning(f"JWT JWKS decode failed: {e}")

    # ── Fallback: HS256 shared secret (legacy) ───────────────────────────────
    secret = getattr(settings, 'SUPABASE_JWT_SECRET', '')
    if secret:
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=['HS256'],
                options={'verify_aud': False},
            )
        except Exception as e:
            errors.append(f"HS256 failed: {e}")
            logger.warning(f"JWT HS256 decode failed: {e}")

    detail = ' | '.join(errors) if errors else 'SUPABASE_URL and SUPABASE_JWT_SECRET are both unset'
    raise ValueError(f'Cannot decode JWT — {detail}')


def get_user_from_request(info) -> CustomUser:
    """
    Extract and verify the JWT from the Authorization header, then return
    the matching CustomUser. Raises ValueError/CustomUser.DoesNotExist on failure.
    """
    request = info.context['request']
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Bearer '):
        raise ValueError('Missing or invalid Authorization header')

    token = auth_header.split(' ', 1)[1]
    payload = decode_jwt(token)
    supabase_id = payload.get('sub')
    if not supabase_id:
        raise ValueError('JWT missing sub claim')

    email = payload.get('email', '')

    # Primary lookup: by supabase_id (the stable identity)
    # Use supabase_id as username to guarantee uniqueness (never conflicts with email)
    try:
        user, created = CustomUser.objects.select_related('active_tenant').get_or_create(
            supabase_id=supabase_id,
            defaults={
                'email': email,
                'username': supabase_id,  # UUID — never conflicts
                'display_name': email.split('@')[0] if email else '',
            },
        )
        if created:
            logger.info(f'Auto-created CustomUser for supabase_id={supabase_id} email={email}')
        return user

    except IntegrityError:
        # Edge case: a Django user exists with this email but a DIFFERENT supabase_id.
        # This happens when the Supabase user was deleted and re-registered
        # (new UUID, same email). We adopt the new supabase_id.
        logger.warning(
            f'IntegrityError creating user for supabase_id={supabase_id} email={email}. '
            f'Attempting recovery by email lookup.'
        )
        try:
            user = CustomUser.objects.select_related('active_tenant').get(email=email)
            user.supabase_id = supabase_id
            user.save(update_fields=['supabase_id'])
            logger.info(f'Recovered: updated supabase_id for email={email}')
            return user
        except CustomUser.DoesNotExist:
            raise ValueError(f'Cannot create or recover user for email={email}')


def get_tenant_from_user(user: CustomUser) -> Tenant:
    """
    Return the user's active tenant. Falls back to the first membership if
    active_tenant is not set.
    """
    if user.active_tenant_id:
        return user.active_tenant

    membership = (
        user.memberships
        .filter(is_active=True)
        .select_related('tenant')
        .first()
    )
    if membership:
        tenant = membership.tenant
        user.active_tenant = tenant
        user.save(update_fields=['active_tenant'])
        return tenant

    raise ValueError(f'User {user.email} has no active tenant')
