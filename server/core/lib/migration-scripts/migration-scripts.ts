import { sequelizeTypescript } from '@server/initializers/database.js'
import { ApplicationModel } from '@server/models/application/application.js'
import { runPeerTube83MigrationScript } from './peertube-8.3.js'
import { MigrationScriptLogger } from './shared.js'

export type { MigrationScriptLogger }

// In the order they must be run
const MIGRATION_SCRIPTS: { name: string, run?: (logger: MigrationScriptLogger) => Promise<void> }[] = [
  { name: 'peertube-4.0' },
  { name: 'peertube-4.2' },
  { name: 'peertube-5.0' },
  { name: 'peertube-6.3' },
  { name: 'peertube-7.2' },
  { name: 'peertube-8.0' },
  { name: 'peertube-8.1' },
  { name: 'peertube-8.3', run: runPeerTube83MigrationScript }
]

export const MIGRATION_SCRIPT_NAMES = MIGRATION_SCRIPTS.map(s => s.name)

// Arbitrary key of the PostgreSQL advisory lock ensuring a single process runs migration scripts
const MIGRATION_SCRIPTS_LOCK_KEY = 812342100

export function isAutomaticMigrationScript (name: string) {
  return !!getAutomaticMigrationScript(name)
}

/**
 * The script may be run by the server and by the CLI at the same time, so it is run while holding a PostgreSQL advisory lock
 * If the lock is held by another process, wait for it if `waitForLock` is true, or skip the script otherwise
 */
export async function runAutomaticMigrationScript (
  name: string,
  logger: MigrationScriptLogger,
  options: { waitForLock: boolean }
): Promise<'run' | 'already-run' | 'locked'> {
  const run = getAutomaticMigrationScript(name)
  if (!run) throw new Error(`Unknown automatic migration script ${name}`)

  // A session lock is bound to its connection, so use a dedicated connection
  const connectionManager = (sequelizeTypescript as any).connectionManager as {
    getConnection: (options: { type: 'write' }) => Promise<PgConnection>
    releaseConnection: (connection: PgConnection) => Promise<void> | void
    destroyConnection: (connection: PgConnection) => Promise<void> | void
  }

  const connection = await connectionManager.getConnection({ type: 'write' })
  let locked = false

  try {
    const { rows } = await connection.query(`SELECT pg_try_advisory_lock(${MIGRATION_SCRIPTS_LOCK_KEY}) AS "locked"`)
    locked = rows[0].locked === true

    if (!locked) {
      if (options.waitForLock !== true) return 'locked'

      logger.info(`Migration scripts are being run by another process (PeerTube?), waiting for it to finish...`)

      await connection.query(`SELECT pg_advisory_lock(${MIGRATION_SCRIPTS_LOCK_KEY})`)
      locked = true
    }

    // The other process may have run the script while we were waiting
    const application = await ApplicationModel.load()
    if (application.manualMigrationScriptsRun.includes(name)) return 'already-run'

    await run(logger)

    await ApplicationModel.setManualMigrationScriptRun(name)

    return 'run'
  } finally {
    try {
      if (locked) await connection.query(`SELECT pg_advisory_unlock(${MIGRATION_SCRIPTS_LOCK_KEY})`)

      await connectionManager.releaseConnection(connection)
    } catch {
      // Don't put back in the pool a connection that may still hold the lock
      await connectionManager.destroyConnection(connection)
    }
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

type PgConnection = { query: (sql: string) => Promise<{ rows: any[] }> }

function getAutomaticMigrationScript (name: string) {
  return MIGRATION_SCRIPTS.find(s => s.name === name)?.run
}
