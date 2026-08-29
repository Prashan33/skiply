import 'server-only'

// Live Content API — keeps server-rendered content up to date. `<SanityLive />`
// must be rendered in the root layout. https://github.com/sanity-io/next-sanity
import { defineLive } from 'next-sanity/live'

import { client } from './client'
import { token } from './token'

export const { sanityFetch, SanityLive } = defineLive({
  client,
  // The dataset is private: the server needs the token to read it. `browserToken`
  // is only exercised under Draft Mode (not enabled yet) for live overlays.
  serverToken: token,
  browserToken: token,
})
