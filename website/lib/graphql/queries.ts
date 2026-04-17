export const SUBCATEGORIAS_SEARCH_QUERY = `
  query SubcategoriasSearch($search: String!, $limit: Int) {
    subcategorias(search: $search, limit: $limit) {
      id nombre slug categoriaId categoriaNombre
    }
  }
`

export const DIRECTORIO_SEARCH_QUERY = `
  query DirectorioSearch($search: String!, $limit: Int) {
    directorio(search: $search, limit: $limit) {
      empresas { id nombreComercial slug ciudad estado }
    }
  }
`
