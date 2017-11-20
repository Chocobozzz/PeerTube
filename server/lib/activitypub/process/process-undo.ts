import { ActivityUndo } from '../../../../shared/models/activitypub/activity'
import { logger } from '../../../helpers/logger'
import { database as db } from '../../../initializers'

async function processUndoActivity (activity: ActivityUndo) {
  const activityToUndo = activity.object

  if (activityToUndo.type === 'Follow') {
    const follower = await db.Account.loadByUrl(activity.actor)
    const following = await db.Account.loadByUrl(activityToUndo.object)
    const accountFollow = await db.AccountFollow.loadByAccountAndTarget(follower.id, following.id)

    if (!accountFollow) throw new Error(`'Unknown account follow (${follower.id} -> ${following.id}.`)

    await accountFollow.destroy()

    return undefined
  }

  logger.warn('Unknown activity object type %s -> %s when undo activity.', activityToUndo.type, { activity: activity.id })

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processUndoActivity
}

// ---------------------------------------------------------------------------
