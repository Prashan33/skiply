import 'server-only'

import { client } from './client'
import {
  BOOKMARKED_COURSES_QUERY,
  CATALOG_COURSES_QUERY,
  PROGRESS_BY_USER_QUERY,
  SEARCH_INDEX_QUERY,
  VIDEO_MOMENTS_QUERY,
} from './queries'
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

/**
 * Course -> module -> lesson index that the search results page joins against to
 * ground every card (labels, key points, poster). See `SEARCH_INDEX_QUERY`.
 */
export function getSearchIndex() {
  return getReadClient().fetch(
    SEARCH_INDEX_QUERY,
    {},
    { next: { revalidate: 300, tags: ['course', 'lesson'] } }
  )
}

/**
 * Chapter/transcript rows of the matched lessons' videos that match the query
 * tokens, for two-stage timestamp resolution in the search route. Query-specific
 * and cheap, so it is not cached. `tokens` are wildcarded (`["*data*"]`).
 */
export function getVideoMoments(slugs: string[], tokens: string[]) {
  return getReadClient().fetch(VIDEO_MOMENTS_QUERY, { slugs, tokens })
}

/**
 * A learner's progress record, keyed by the Clerk user id. Per-user and mutable,
 * so it is never statically cached; the `progress:<userId>` tag lets the write
 * route revalidate it. Callers already opt into dynamic rendering via `auth()`.
 */
export function getProgressForUser(userId: string) {
  return getReadClient().fetch(
    PROGRESS_BY_USER_QUERY,
    { userId },
    { next: { revalidate: 0, tags: [`progress:${userId}`] } }
  )
}

/**
 * Catalog cards for the My Learning page: the courses a learner has bookmarked
 * directly plus the parent course of every bookmarked lesson. Depends on
 * per-user input, so it is never statically cached and is revalidated by the
 * bookmark write route via the `progress:<userId>` tag.
 */
export function getBookmarkedCourses(
  userId: string,
  courseIds: string[],
  lessonIds: string[]
) {
  return getReadClient().fetch(
    BOOKMARKED_COURSES_QUERY,
    { courseIds, lessonIds },
    { next: { revalidate: 0, tags: [`progress:${userId}`] } }
  )
}
