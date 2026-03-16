import { ActivityAudience, ActivityDownload } from '@peertube/peertube-models'
import { MActorAudience, MActorLight, MVideoImmutable, MVideoUrl } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { logger } from '../../../helpers/logger.js'
import { audiencify, getPublicAudience } from '../audience.js'
import { getDownloadsActivityPubUrl } from '../url.js'
import { sendVideoRelatedActivity } from './shared/send-utils.js'

async function sendDownload (options: {
  byActor: MActorLight
  video: MVideoImmutable
  transaction?: Transaction
}) {
  const { byActor, video, transaction } = options

  logger.info('Creating job to send downloads of %s.', video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getDownloadsActivityPubUrl(byActor, video)

    return buildDownloadActivity({
      url,
      byActor,
      video,
      audience
    })
  }

  return sendVideoRelatedActivity(activityBuilder, {
    byActor,
    video,
    transaction,
    contextType: 'Download',
    parallelizable: true
  })
}

// ---------------------------------------------------------------------------

export { sendDownload }

// ---------------------------------------------------------------------------

function buildDownloadActivity (options: {
  url: string
  byActor: MActorAudience
  video: MVideoUrl
  audience?: ActivityAudience
}): ActivityDownload {
  const {
    url,
    byActor,
    video,
    audience = getPublicAudience(byActor)
  } = options

  return audiencify({
    id: url,
    type: 'Download' as 'Download',
    actor: byActor.url,
    object: video.url
  }, audience)
}
