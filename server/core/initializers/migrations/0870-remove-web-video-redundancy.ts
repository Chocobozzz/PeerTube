import { logger } from '@server/helpers/logger.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { remove } from 'fs-extra'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import { QueryTypes } from 'sequelize'
import { CONFIG } from '../config.js'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    const query = 'SELECT "videoFileId" FROM "videoRedundancy" WHERE "strategy" IS NOT NULL AND "videoFileId" IS NOT NULL'

    const rows = await utils.sequelize.query<{ videoFileId: number }>(query, {
      transaction,
      type: QueryTypes.SELECT as QueryTypes.SELECT
    })

    for (const { videoFileId } of rows) {
      try {
        const videoFile = await VideoFileModel.loadWithVideo(videoFileId, transaction)
        const filePath = join(CONFIG.STORAGE.REDUNDANCY_DIR, videoFile.filename)

        await remove(filePath)
      } catch (err) {
        logger.error(`Cannot delete redundancy file (videoFileId: ${videoFileId}).`, { err })
      }
    }
  }

  {
    const query = 'DELETE FROM "videoRedundancy" WHERE "videoFileId" IS NOT NULL'

    await utils.sequelize.query(query, { transaction })
  }

  {
    await utils.sequelize.query('DROP INDEX IF EXISTS video_redundancy_video_file_id', { transaction })
  }

  {
    await utils.queryInterface.removeColumn('videoRedundancy', 'videoFileId', { transaction })
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }

    await utils.queryInterface.changeColumn('videoRedundancy', 'videoStreamingPlaylistId', data, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down, up
}
