import { PeerTubeHelpers } from '@server/typings/plugins'
import { sequelizeTypescript } from '@server/initializers/database'
import { buildLogger } from '@server/helpers/logger'
import { VideoModel } from '@server/models/video/video'

function buildPluginHelpers (npmName: string): PeerTubeHelpers {
  const logger = buildPluginLogger(npmName)

  const database = buildDatabaseHelpers()
  const videos = buildVideosHelpers()

  return {
    logger,
    database,
    videos
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

function buildVideosHelpers () {
  return {
    removeVideo: (id: number) => {
      return sequelizeTypescript.transaction(async t => {
        const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(id, t)

        await video.destroy({ transaction: t })
      })
    }
  }
}
