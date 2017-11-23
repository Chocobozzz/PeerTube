import { ActivityLike } from '../../../../shared/models/activitypub/activity'
import { database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
import { getOrCreateAccountAndServer } from '../account'
import { sendLikeToVideoFollowers } from '../send/send-like'
import { retryTransactionWrapper } from '../../../helpers/database-utils'

async function processLikeActivity (activity: ActivityLike) {
  const account = await getOrCreateAccountAndServer(activity.actor)

  return processLikeVideo(account, activity.object)
}

// ---------------------------------------------------------------------------

export {
  processLikeActivity
}

// ---------------------------------------------------------------------------

async function processLikeVideo (byAccount: AccountInstance, videoUrl: string) {
  const options = {
    arguments: [ byAccount, videoUrl ],
    errorMessage: 'Cannot like the video with many retries.'
  }

  return retryTransactionWrapper(createVideoLike, options)
}

function createVideoLike (byAccount: AccountInstance, videoUrl: string) {
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
      defaults: rate
    })
    await video.increment('likes')

    if (video.isOwned() && created === true) await sendLikeToVideoFollowers(byAccount, video, undefined)
  })
}
