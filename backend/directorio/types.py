"""Strawberry GraphQL type definitions for the directorio app."""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime

import strawberry
import strawberry_django
from strawberry import auto

from directorio.models import Categoria, Subcategoria, EmpresaPerfil, SolicitudCotizacion


@strawberry_django.type(Categoria)
class CategoriaType:
    id: auto
    codigo: auto
    nombre: auto
    slug: auto
    descripcion: auto
    icono: auto
    orden: auto
    activa: auto


@strawberry_django.type(Subcategoria)
class SubcategoriaType:
    id: auto
    categoria_id: strawberry.ID
    nombre: auto
    slug: auto
    descripcion: auto
    keywords: auto
    orden: auto

    @strawberry.field
    def categoria_nombre(self) -> str:
        return self.categoria.nombre


@strawberry_django.type(EmpresaPerfil)
class EmpresaPerfilType:
    id: auto
    nombre_comercial: auto
    slug: auto
    descripcion: auto
    ciudad: auto
    estado: auto
    pais: auto
    telefono: auto
    email_contacto: auto
    sitio_web: auto
    whatsapp: auto
    plan: auto
    status: auto
    score_completitud: auto
    verified: auto
    created_at: auto
    updated_at: auto
    published_at: Optional[datetime]
    categorias: List[CategoriaType]
    subcategorias: List[SubcategoriaType]
    categoria_principal: Optional[CategoriaType]

    @strawberry.field
    def logo_url(self) -> Optional[str]:
        if self.logo:
            return self.logo.url
        return None

    @strawberry.field
    def portada_url(self) -> Optional[str]:
        if self.portada:
            return self.portada.url
        return None


@strawberry_django.type(EmpresaPerfil)
class EmpresaPerfilPublicType:
    """Reduced type for public directory listing — no contact details gated."""
    id: auto
    nombre_comercial: auto
    slug: auto
    descripcion: auto
    ciudad: auto
    estado: auto
    pais: auto
    telefono: auto
    sitio_web: auto
    whatsapp: auto
    plan: auto
    score_completitud: auto
    verified: auto
    published_at: Optional[datetime]
    categorias: List[CategoriaType]
    categoria_principal: Optional[CategoriaType]

    @strawberry.field
    def logo_url(self) -> Optional[str]:
        if self.logo:
            return self.logo.url
        return None

    @strawberry.field
    def portada_url(self) -> Optional[str]:
        if self.portada:
            return self.portada.url
        return None


@strawberry_django.type(SolicitudCotizacion)
class SolicitudCotizacionType:
    id: auto
    nombre_contacto: auto
    email_contacto: auto
    telefono: auto
    empresa_compradora: auto
    mensaje: auto
    status: auto
    oculto_free: auto
    created_at: auto


@strawberry.type
class DashboardStats:
    total_vistas: int
    total_leads: int
    leads_nuevos: int
    score_completitud: int
    plan: str
    empresa_publicada: bool


@strawberry.type
class DirectorioResultType:
    empresas: List[EmpresaPerfilPublicType]
    total: int
    has_more: bool
