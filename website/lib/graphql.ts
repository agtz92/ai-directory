const PUBLIC_GQL = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:8000/public/graphql/'

export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  revalidate = 3600,
): Promise<T> {
  const res = await fetch(PUBLIC_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
  })
  if (!res.ok) throw new Error(`GraphQL request failed: ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data as T
}
