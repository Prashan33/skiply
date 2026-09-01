import 'server-only'

import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId } from '../env'

/**
 * Server-only write client for learner progress (AGENTS.md §5/§12). It carries an
 * **Editor** token (`SANITY_API_WRITE_TOKEN`) and must only ever be used inside a
 * server route. Never import this from a Client Component — the token has no
 * `NEXT_PUBLIC_` prefix, so it is never inlined into the browser bundle.
 */
export function requireWriteToken(): string {
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!token) {
    throw new Error('Missing environment variable: SANITY_API_WRITE_TOKEN')
  }
  return token
}

export function getWriteClient() {
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: requireWriteToken(),
  })
}
