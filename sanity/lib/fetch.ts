import 'server-only'

import { client } from './client'
import { requireToken } from './token'

export { sanityFetch, SanityLive } from './live'

/**
 * Token-bearing, CDN-bypassing client for reads that must be fresh and are not
 * driven by the Live Content API — e.g. `generateStaticParams`.
 */
export function getReadClient() {
  return client.withConfig({ token: requireToken(), useCdn: false })
}
