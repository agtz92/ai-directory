"""
Plan limits — SINGLE SOURCE OF TRUTH for all plan restrictions.

Edit the _LIMITS dict below to change what each plan allows.
No migration needed: values are read at runtime.
Restart Django (or gunicorn) after saving.

See backend/edit_plans.md for full instructions.
"""

from typing import Any
import strawberry

# ─── Limits table ─────────────────────────────────────────────────────────────
# 999 = "unlimited" (use _UNLIMITED sentinel, never hardcode in UI)

_UNLIMITED = 999

_LIMITS: dict[str, dict[str, Any]] = {
    'free': {
        'max_categorias':      1,       # how many categories the empresa can be listed under
        'max_subcategorias':   15,       # how many subcategories
        'puede_ver_leads':     False,   # can read lead content (nombre, email, mensaje)
        'puede_subir_portada': False,   # can upload a cover/banner image
        'max_fotos_galeria':   0,       # gallery photos (Phase 2)
        'badge_verificado':    False,   # shows "Verified" badge on public profile
        'soporte':             'comunidad',
    },
    'starter': {
        'max_categorias':      3,
        'max_subcategorias':   15,
        'puede_ver_leads':     True,
        'puede_subir_portada': True,
        'max_fotos_galeria':   5,
        'badge_verificado':    False,
        'soporte':             'email',
    },
    'pro': {
        'max_categorias':      _UNLIMITED,
        'max_subcategorias':   _UNLIMITED,
        'puede_ver_leads':     True,
        'puede_subir_portada': True,
        'max_fotos_galeria':   20,
        'badge_verificado':    True,
        'soporte':             'prioritario',
    },
    'enterprise': {
        'max_categorias':      _UNLIMITED,
        'max_subcategorias':   _UNLIMITED,
        'puede_ver_leads':     True,
        'puede_subir_portada': True,
        'max_fotos_galeria':   _UNLIMITED,
        'badge_verificado':    True,
        'soporte':             'dedicado',
    },
}

# Plan display metadata (for pricing page / upgrade modal)
_PLAN_META: dict[str, tuple[str, int]] = {
    # slug: (display name, monthly price in MXN; 0 = contact sales)
    'free':       ('Gratuito',    0),
    'starter':    ('Starter',   299),
    'pro':        ('Pro',       799),
    'enterprise': ('Enterprise',  0),
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_limits(plan: str) -> dict[str, Any]:
    """Return the limits dict for a plan slug. Falls back to 'free' if unknown."""
    return _LIMITS.get(plan, _LIMITS['free'])


def enforce_max(empresa, feature: str, current_count: int, label: str = '') -> None:
    """
    Raise ValueError if current_count is AT or ABOVE the plan max for `feature`.
    `feature` must be a key in _LIMITS holding an int.

    Example:
        enforce_max(empresa, 'max_categorias', empresa.categorias.count(), 'categorías')
    """
    limits = get_limits(empresa.plan)
    max_val: int = limits.get(feature, 0)
    if max_val < _UNLIMITED and current_count >= max_val:
        label = label or feature
        raise ValueError(
            f'Tu plan "{empresa.plan}" permite hasta {max_val} {label}. '
            f'Actualiza tu plan para agregar más.'
        )


def enforce_bool(empresa, feature: str, label: str = '') -> None:
    """
    Raise ValueError if a boolean feature is False for the empresa's plan.

    Example:
        enforce_bool(empresa, 'puede_subir_portada', 'subir portada')
    """
    limits = get_limits(empresa.plan)
    if not limits.get(feature, False):
        label = label or feature
        raise ValueError(
            f'Tu plan "{empresa.plan}" no incluye {label}. '
            f'Actualiza tu plan para acceder a esta función.'
        )


# ─── Strawberry types (sent to frontend via GraphQL) ─────────────────────────

@strawberry.type
class PlanLimitsType:
    """Current plan's limits. Returned inside MeType so the frontend has
    the authoritative constraints without hardcoding them."""
    max_categorias:      int
    max_subcategorias:   int
    puede_ver_leads:     bool
    puede_subir_portada: bool
    max_fotos_galeria:   int
    badge_verificado:    bool
    soporte:             str


@strawberry.type
class PlanInfoType:
    """Full plan description. Returned by the public `planes` query
    so the pricing/upgrade page can render without hardcoding."""
    slug:           str
    nombre:         str
    precio_mensual: int   # MXN; 0 means "contact sales"
    limits:         PlanLimitsType


def build_plan_limits(plan: str) -> PlanLimitsType:
    d = get_limits(plan)
    return PlanLimitsType(
        max_categorias=d['max_categorias'],
        max_subcategorias=d['max_subcategorias'],
        puede_ver_leads=d['puede_ver_leads'],
        puede_subir_portada=d['puede_subir_portada'],
        max_fotos_galeria=d['max_fotos_galeria'],
        badge_verificado=d['badge_verificado'],
        soporte=d['soporte'],
    )


def build_all_plans() -> list[PlanInfoType]:
    """Returns all plans ordered by price ascending (for pricing page)."""
    return [
        PlanInfoType(
            slug=slug,
            nombre=nombre,
            precio_mensual=precio,
            limits=build_plan_limits(slug),
        )
        for slug, (nombre, precio) in _PLAN_META.items()
    ]
