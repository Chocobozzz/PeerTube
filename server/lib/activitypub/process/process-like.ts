import { ActivityLike } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { VideoModel } from '../../../models/video/video'
import { getOrCreateAccountAndServer } from '../account'
import { forwardActivity } from '../send/misc'

async function processLikeActivity (activity: ActivityLike) {
  const account = await getOrCreateAccountAndServer(activity.actor)

  return processLikeVideo(account, activity)
}

// ---------------------------------------------------------------------------

export {
  processLikeActivity
}

// ---------------------------------------------------------------------------

async function processLikeVideo (byAccount: AccountModel, activity: ActivityLike) {
  const options = {
    arguments: [ byAccount, activity ],
    errorMessage: 'Cannot like the video with many retries.'
  }

  return retryTransactionWrapper(createVideoLike, options)
}

function createVideoLike (byAccount: AccountModel, activity: ActivityLike) {
  const videoUrl = activity.object

  return sequelizeTypescript.transaction(async t => {
    const video = await VideoModel.loadByUrlAndPopulateAccount(videoUrl)

    if (!video) throw new Error('Unknown video ' + videoUrl)

    const rate = {
      type: 'like' as 'like',
      videoId: video.id,
      accountId: byAccount.id
    }
    const [ , created ] = await AccountVideoRateModel.findOrCreate({
      where: rate,
      defaults: rate,
      transaction: t
    })
    if (created === true) await video.increment('likes', { transaction: t })

    if (video.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ byAccount ]
      await forwardActivity(activity, t, exceptions)
    }
  })
}
