import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { installReadReplicaRouter } from './shared/read-replica-router.js'
import { recordUserWrite } from './shared/user-recent-writes.js'

let router: ReturnType<typeof installReadReplicaRouter>

export function initDatabaseReadReplicas () {
  if (router || !areDatabaseReadReplicasEnabled()) return

  router = installReadReplicaRouter({
    sequelize: sequelizeTypescript,
    hosts: CONFIG.DATABASE.READ_REPLICAS.HOSTS
  })
}

// For writes concerning another user than the one of the current request (fetched from the context)
export async function recordUserDatabaseWrite (userId: number) {
  if (!router) return

  await recordUserWrite(userId)
}

export async function closeDatabaseReadReplicas () {
  if (!router) return

  await router.close()
}

export function getDatabaseReadReplicas () {
  if (!router) return []

  return router.monitor.getReplicas()
}

export function getDatabaseReadReplicasStats () {
  if (!router) return { replicaQueries: 0, primaryFallbackQueries: 0 }

  return router.stats
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function areDatabaseReadReplicasEnabled () {
  return CONFIG.DATABASE.READ_REPLICAS.HOSTS.length !== 0
}
