import { ActivityLike } from '../../../../shared/models/activitypub/activity'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
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

async function processLikeVideo (byAccount: AccountInstance, activity: ActivityLike) {
  const options = {
    arguments: [ byAccount, activity ],
    errorMessage: 'Cannot like the video with many retries.'
  }

  return retryTransactionWrapper(createVideoLike, options)
}

function createVideoLike (byAccount: AccountInstance, activity: ActivityLike) {
  const videoUrl = activity.object

  return db.sequelize.transaction(async t => {
    const video = await db.Video.loadByUrlAndPopulateAccount(videoUrl)

    if (!video) throw new Error('Unknown video ' + videoUrl)

    const rate = {
      type: 'like' as 'like',
      videoId: video.id,
      accountId: byAccount.id
    }
    const [ , created ] = await db.AccountVideoRate.findOrCreate({
      where: rate,
      defaults: rate,
      transaction: t
    })
    await video.increment('likes', { transaction: t })

    if (video.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ byAccount ]
      await forwardActivity(activity, t, exceptions)
    }
  })
}
