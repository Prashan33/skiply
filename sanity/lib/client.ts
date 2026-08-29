import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId } from '../env'

/**
 * Base, token-less client. Safe for building image URLs and other non-sensitive
 * use. All *content* reads go through `sanityFetch` / `getReadClient` in
 * `./fetch`, which attach the server-only read token for the private dataset.
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
})
