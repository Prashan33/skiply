import 'server-only'

import { client } from './client'
import { CATALOG_COURSES_QUERY } from './queries'
import { requireToken } from './token'

export { sanityFetch, SanityLive } from './live'

/**
 * Token-bearing, CDN-bypassing client for reads that must be fresh and are not
 * driven by the Live Content API — e.g. `generateStaticParams`.
 *
 * `defineLive`'s `sanityFetch` only attaches the token for draft perspectives,
 * so it cannot read published content from the private dataset. Content pages
 * use this client instead, with `next: { revalidate, tags }` for caching.
 */
export function getReadClient() {
  return client.withConfig({ token: requireToken(), useCdn: false })
}

/** The catalog list, shared by the homepage and the `/courses` index. */
export function getCatalogCourses() {
  return getReadClient().fetch(
    CATALOG_COURSES_QUERY,
    {},
    { next: { revalidate: 60, tags: ['course'] } }
  )
}
