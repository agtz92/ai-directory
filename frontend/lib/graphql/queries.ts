import { gql } from '@apollo/client'

export const ME_QUERY = gql`
  query Me {
    me {
      id email displayName role
      tenantSlug tenantName tenantId tenantColor tenantModules
      tenants { id name slug color modules }
      empresaPlan empresaStatus
      planLimits {
        maxCategorias maxSubcategorias maxModelosPorSubcategoria
        puedeVerLeads puedeSubirPortada
        maxFotosGaleria badgeVerificado soporte
      }
    }
  }
`

export const MI_EMPRESA_QUERY = gql`
  query MiEmpresa {
    miEmpresa {
      id nombreComercial slug descripcion
      ciudad estado pais
      telefono emailContacto sitioWeb whatsapp
      plan status scoreCompletitud verified
      csfStatus csfUrl
      publishedAt createdAt updatedAt
      logoUrl portadaUrl
      categoriaPrincipal { id nombre slug icono }
      categorias { id nombre slug icono }
      subcategorias { id nombre slug categoriaId categoriaNombre }
    }
  }
`

export const CATEGORIAS_QUERY = gql`
  query Categorias($search: String, $activasOnly: Boolean) {
    categorias(search: $search, activasOnly: $activasOnly) {
      id codigo nombre slug icono descripcion orden activa
    }
  }
`

export const SUBCATEGORIAS_QUERY = gql`
  query Subcategorias($categoriaId: ID, $search: String) {
    subcategorias(categoriaId: $categoriaId, search: $search) {
      id nombre slug categoriaId categoriaNombre
    }
  }
`

export const SUBCATEGORIAS_SEARCH_QUERY = gql`
  query SubcategoriasSearch($search: String!, $limit: Int) {
    subcategorias(search: $search, limit: $limit) {
      id nombre slug categoriaId categoriaNombre
    }
  }
`

export const SOLICITUDES_QUERY = gql`
  query SolicitudesCotizacion($status: String, $limit: Int, $offset: Int) {
    solicitudesCotizacion(status: $status, limit: $limit, offset: $offset) {
      id nombreContacto emailContacto telefono
      empresaCompradora mensaje status ocultoFree createdAt
    }
  }
`

export const DASHBOARD_STATS_QUERY = gql`
  query DashboardStats {
    dashboardStats {
      totalVistas totalLeads leadsNuevos
      scoreCompletitud plan empresaPublicada
    }
  }
`

export const MI_EMPRESA_CON_MODELOS_QUERY = gql`
  query MiEmpresaConModelos {
    miEmpresa {
      id plan
      subcategorias { id nombre slug categoriaId categoriaNombre }
      modelosEmpresa {
        id existencia createdAt updatedAt
        subcategoriaId subcategoriaNombre
        marcaId marcaNombre marcaStatus
        modeloId modeloNombre modeloStatus
        modelo {
          id nombre slug status
          marcaId marcaNombre
          subcategoriaId subcategoriaNombre
        }
      }
    }
  }
`

export const MARCAS_QUERY = gql`
  query Marcas($subcategoriaSlug: String!) {
    marcas(subcategoriaSlug: $subcategoriaSlug) {
      id nombre slug descripcion activa status orden
      subcategoriaId subcategoriaNombre
    }
  }
`

export const MODELOS_QUERY = gql`
  query Modelos($subcategoriaSlug: String!, $marcaId: ID) {
    modelos(subcategoriaSlug: $subcategoriaSlug, marcaId: $marcaId) {
      id nombre slug descripcion activo status orden
      marcaId marcaNombre subcategoriaId subcategoriaNombre
    }
  }
`

export const MIS_MARCAS_PROPUESTAS_QUERY = gql`
  query MisMarcasPropuestas {
    misMarcasPropuestas {
      id nombre slug status motivoRechazo createdAt
      subcategoriaId subcategoriaNombre
    }
  }
`

export const MIS_MODELOS_PROPUESTOS_QUERY = gql`
  query MisModelosPropuestos {
    misModelosPropuestos {
      id nombre slug status motivoRechazo createdAt
      marcaId marcaNombre subcategoriaId subcategoriaNombre
    }
  }
`
