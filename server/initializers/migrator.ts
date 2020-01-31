import * as path from 'path'
import { logger } from '../helpers/logger'
import { LAST_MIGRATION_VERSION } from './constants'
import { sequelizeTypescript } from './database'
import { readdir } from 'fs-extra'
import { QueryTypes } from 'sequelize'

async function migrate () {
  const tables = await sequelizeTypescript.getQueryInterface().showAllTables()

  // No tables, we don't need to migrate anything
  // The installer will do that
  if (tables.length === 0) return

  let actualVersion: number | null = null

  const query = 'SELECT "migrationVersion" FROM "application"'
  const options = {
    type: QueryTypes.SELECT as QueryTypes.SELECT
  }

  const rows = await sequelizeTypescript.query<{ migrationVersion: number }>(query, options)
  if (rows?.[0]?.migrationVersion) {
    actualVersion = rows[0].migrationVersion
  }

  if (actualVersion === null) {
    await sequelizeTypescript.query('INSERT INTO "application" ("migrationVersion") VALUES (0)')
    actualVersion = 0
  }

  // No need migrations, abort
  if (actualVersion >= LAST_MIGRATION_VERSION) return

  // If there are a new migration scripts
  logger.info('Begin migrations.')

  const migrationScripts = await getMigrationScripts()

  for (const migrationScript of migrationScripts) {
    try {
      await executeMigration(actualVersion, migrationScript)
    } catch (err) {
      logger.error('Cannot execute migration %s.', migrationScript.version, { err })
      process.exit(-1)
    }
  }

  logger.info('Migrations finished. New migration version schema: %s', LAST_MIGRATION_VERSION)
}

// ---------------------------------------------------------------------------

export {
  migrate
}

// ---------------------------------------------------------------------------

async function getMigrationScripts () {
  const files = await readdir(path.join(__dirname, 'migrations'))
  const filesToMigrate: {
    version: string
    script: string
  }[] = []

  files
    .filter(file => file.endsWith('.js.map') === false)
    .forEach(file => {
      // Filename is something like 'version-blabla.js'
      const version = file.split('-')[0]
      filesToMigrate.push({
        version,
        script: file
      })
    })

  return filesToMigrate
}

async function executeMigration (actualVersion: number, entity: { version: string, script: string }) {
  const versionScript = parseInt(entity.version, 10)

  // Do not execute old migration scripts
  if (versionScript <= actualVersion) return undefined

  // Load the migration module and run it
  const migrationScriptName = entity.script
  logger.info('Executing %s migration script.', migrationScriptName)

  const migrationScript = require(path.join(__dirname, 'migrations', migrationScriptName))

  return sequelizeTypescript.transaction(async t => {
    const options = {
      transaction: t,
      queryInterface: sequelizeTypescript.getQueryInterface(),
      sequelize: sequelizeTypescript
    }

    await migrationScript.up(options)

    // Update the new migration version
    await sequelizeTypescript.query('UPDATE "application" SET "migrationVersion" = ' + versionScript, { transaction: t })
  })
}
