"""Strawberry GraphQL type definitions for the directorio app."""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime

import strawberry
import strawberry_django
from strawberry import auto

from directorio.models import (
    Categoria, Subcategoria, EmpresaPerfil, SolicitudCotizacion,
    Marca, Modelo, EmpresaModelo, NotificacionStaff,
)


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


@strawberry_django.type(Marca)
class MarcaType:
    id: auto
    subcategoria_id: strawberry.ID
    nombre: auto
    slug: auto
    descripcion: auto
    activa: auto
    status: auto
    motivo_rechazo: auto
    orden: auto
    created_at: auto

    @strawberry.field
    def subcategoria_nombre(self) -> str:
        return self.subcategoria.nombre


@strawberry_django.type(Modelo)
class ModeloType:
    id: auto
    subcategoria_id: strawberry.ID
    marca_id: Optional[strawberry.ID]
    nombre: auto
    slug: auto
    descripcion: auto
    activo: auto
    status: auto
    motivo_rechazo: auto
    orden: auto
    created_at: auto

    @strawberry.field
    def marca_nombre(self) -> Optional[str]:
        return self.marca.nombre if self.marca_id else None

    @strawberry.field
    def subcategoria_nombre(self) -> str:
        return self.subcategoria.nombre


@strawberry_django.type(EmpresaModelo)
class EmpresaModeloType:
    id: auto
    empresa_id: strawberry.ID
    subcategoria_id: strawberry.ID
    marca_id: Optional[strawberry.ID]
    modelo_id: Optional[strawberry.ID]
    existencia: auto
    created_at: auto
    updated_at: auto

    @strawberry.field
    def subcategoria_nombre(self) -> str:
        return self.subcategoria.nombre

    @strawberry.field
    def marca_nombre(self) -> Optional[str]:
        return self.marca.nombre if self.marca_id else None

    @strawberry.field
    def modelo_nombre(self) -> Optional[str]:
        return self.modelo.nombre if self.modelo_id else None

    @strawberry.field
    def marca_status(self) -> Optional[str]:
        return self.marca.status if self.marca_id else None

    @strawberry.field
    def modelo_status(self) -> Optional[str]:
        return self.modelo.status if self.modelo_id else None

    @strawberry.field
    def modelo(self) -> Optional[ModeloType]:
        return self.modelo if self.modelo_id else None


@strawberry.type
class NotificacionStaffType:
    id: strawberry.ID
    tipo: str
    referencia_id: int
    mensaje: str
    leida: bool
    created_at: datetime


@strawberry.type
class TenantBasicType:
    id: strawberry.ID
    name: str
    slug: str


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
    csf_status: auto
    created_at: auto
    updated_at: auto
    published_at: Optional[datetime]
    categorias: List[CategoriaType]
    subcategorias: List[SubcategoriaType]
    categoria_principal: Optional[CategoriaType]

    @strawberry.field
    def tenant(self) -> Optional[TenantBasicType]:
        if not self.tenant_id:
            return None
        # Use the already-cached tenant when select_related('tenant') was applied.
        # Fallback to a DB lookup otherwise.
        t = self.__dict__.get('tenant') or EmpresaPerfil.objects.select_related('tenant').get(pk=self.pk).tenant
        return TenantBasicType(id=str(t.pk), name=t.name, slug=t.slug)

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

    @strawberry.field
    def csf_url(self) -> Optional[str]:
        if self.csf_documento:
            return self.csf_documento.url
        return None

    @strawberry.field
    def modelos_empresa(self) -> List[EmpresaModeloType]:
        return list(
            EmpresaModelo.objects
            .filter(empresa_id=self.pk)
            .select_related('subcategoria', 'marca', 'modelo__marca', 'modelo__subcategoria')
            .order_by('subcategoria__nombre', 'marca__nombre', 'modelo__nombre')
        )


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

    @strawberry.field
    def modelos_empresa(self) -> List[EmpresaModeloType]:
        return list(
            EmpresaModelo.objects
            .filter(empresa_id=self.pk, existencia=True)
            .select_related('subcategoria', 'marca', 'modelo__marca', 'modelo__subcategoria')
            .order_by('subcategoria__nombre', 'marca__nombre', 'modelo__nombre')
        )


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
class SolicitarModeloResult:
    modelo: Optional[ModeloType]
    similares: List[ModeloType]


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
