import { PeerTubeHelpers } from '@server/typings/plugins'
import { sequelizeTypescript } from '@server/initializers/database'
import { buildLogger } from '@server/helpers/logger'

function buildPluginHelpers (npmName: string): PeerTubeHelpers {
  const logger = buildPluginLogger(npmName)

  const database = buildDatabaseHelpers()

  return {
    logger,
    database
  }
}

export {
  buildPluginHelpers
}

// ---------------------------------------------------------------------------

function buildPluginLogger (npmName: string) {
  return buildLogger(npmName)
}

function buildDatabaseHelpers () {
  return {
    query: sequelizeTypescript.query.bind(sequelizeTypescript)
  }
}
