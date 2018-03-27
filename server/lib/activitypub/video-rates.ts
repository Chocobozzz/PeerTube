import { Transaction } from 'sequelize'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import { sendCreateDislike, sendLike, sendUndoDislike, sendUndoLike } from './send'

async function sendVideoRateChange (account: AccountModel,
                              video: VideoModel,
                              likes: number,
                              dislikes: number,
                              t: Transaction) {
  const actor = account.Actor

  // Keep the order: first we undo and then we create

  // Undo Like
  if (likes < 0) await sendUndoLike(actor, video, t)
  // Undo Dislike
  if (dislikes < 0) await sendUndoDislike(actor, video, t)

  // Like
  if (likes > 0) await sendLike(actor, video, t)
  // Dislike
  if (dislikes > 0) await sendCreateDislike(actor, video, t)
}

export {
  sendVideoRateChange
}
