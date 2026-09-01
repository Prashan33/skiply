/**
 * This configuration file lets you run `$ sanity [command]` in this folder
 * Go to https://www.sanity.io/docs/cli to learn more.
 **/
import {defineCliConfig} from 'sanity/cli'

import {dataset, projectId} from './env'

export default defineCliConfig({
  api: {projectId, dataset},
  // Deployed Studio hostname → https://vertex-skiply.sanity.studio
  // Required so the Sanity Context MCP will serve this dataset (AGENTS.md §12).
  studioHost: 'vertex-skiply',
  deployment: {appId: 'zm68jfv3i6srebyukxq5lsx3'},
  typegen: {
    // Scan the web app (repo root, one level up) for GROQ queries.
    path: '../{app,sanity,components,lib}/**/*.{ts,tsx}',
    schema: './schema.json',
    generates: '../sanity.types.ts',
    overloadClientMethods: true,
  },
})
