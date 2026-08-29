import 'server-only'

/**
 * Server-only Sanity read token for the private `production` dataset.
 *
 * Never import this from a Client Component. It has no `NEXT_PUBLIC_` prefix, so
 * it is never inlined into the browser bundle. Create a **Viewer** token at
 * https://www.sanity.io/manage/project/g178ibto/api and put it in `.env.local`
 * as `SANITY_API_READ_TOKEN`. Until it is set, content fetches return 401.
 */
export const token = process.env.SANITY_API_READ_TOKEN

/** Use where a token is mandatory (e.g. bypassing the CDN for fresh reads). */
export function requireToken(): string {
  if (!token) {
    throw new Error('Missing environment variable: SANITY_API_READ_TOKEN')
  }
  return token
}
