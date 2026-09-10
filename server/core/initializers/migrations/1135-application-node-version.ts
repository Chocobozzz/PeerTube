import { ensureDir } from 'fs-extra/esm'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import { CONFIG } from '../config.js'

const NODE_ABI_FILE_NAME = '.peertube-node-abi'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  const rows = await utils.sequelize.query<{ nodeABIVersion: string }>(
    'SELECT "nodeABIVersion" FROM "application"',
    { type: Sequelize.QueryTypes.SELECT, transaction }
  )

  const nodeABIVersion = rows?.[0]?.nodeABIVersion

  if (nodeABIVersion) {
    const pluginsDir = CONFIG.STORAGE.PLUGINS_DIR

    await ensureDir(pluginsDir)
    await writeFile(join(pluginsDir, NODE_ABI_FILE_NAME), nodeABIVersion, 'utf-8')
  }

  await utils.queryInterface.removeColumn('application', 'nodeABIVersion', { transaction })
  await utils.queryInterface.removeColumn('application', 'nodeVersion', { transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
