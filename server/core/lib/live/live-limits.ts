import { uniqify } from '@peertube/peertube-core-utils'
import { CONFIG } from '@server/initializers/config.js'
import { VideoModel } from '@server/models/video/video.js'

// Lives are counted on the account that owns the channel: a collaborator must not bypass the limit of the channel owner
export async function getReachedLiveLimit (options: {
  userAccountId: number
  channelAccountId: number
}): Promise<'instance' | 'user' | undefined> {
  const { userAccountId, channelAccountId } = options

  if (CONFIG.LIVE.MAX_INSTANCE_LIVES !== -1) {
    const totalInstanceLives = await VideoModel.countLives({ remote: false, mode: 'not-ended' })

    if (totalInstanceLives >= CONFIG.LIVE.MAX_INSTANCE_LIVES) return 'instance'
  }

  if (CONFIG.LIVE.MAX_USER_LIVES !== -1) {
    const accountIds = uniqify([ userAccountId, channelAccountId ])
    const totals = await Promise.all(accountIds.map(accountId => VideoModel.countLivesOfAccount(accountId)))

    if (totals.some(total => total >= CONFIG.LIVE.MAX_USER_LIVES)) return 'user'
  }

  return undefined
}
