'use client'

import { ApolloClient, ApolloLink, InMemoryCache, createHttpLink } from '@apollo/client'
import { useAuthStore } from '@/lib/auth-store'

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_STAFF_GRAPHQL_URL ?? 'http://localhost:8000/staff/graphql/',
})

const authLink = new ApolloLink((operation, forward) => {
  const token = useAuthStore.getState().token
  if (token) {
    operation.setContext({
      headers: { Authorization: `Bearer ${token}` },
    })
  }
  return forward(operation)
})

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      EmpresaPerfilType: {
        fields: {
          categorias:    { merge: false },
          subcategorias: { merge: false },
        },
      },
    },
  }),
})
