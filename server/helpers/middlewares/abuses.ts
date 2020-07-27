import { Response } from 'express'
import { AbuseModel } from '../../models/abuse/abuse'
import { fetchVideo } from '../video'

// FIXME: deprecated in 2.3. Remove this function
async function doesVideoAbuseExist (abuseIdArg: number | string, videoUUID: string, res: Response) {
  const abuseId = parseInt(abuseIdArg + '', 10)
  let abuse = await AbuseModel.loadByIdAndVideoId(abuseId, null, videoUUID)

  if (!abuse) {
    const userId = res.locals.oauth?.token.User.id
    const video = await fetchVideo(videoUUID, 'all', userId)

    if (video) abuse = await AbuseModel.loadByIdAndVideoId(abuseId, video.id)
  }

  if (abuse === null) {
    res.status(404)
       .json({ error: 'Video abuse not found' })

    return false
  }

  res.locals.abuse = abuse
  return true
}

async function doesAbuseExist (abuseId: number | string, res: Response) {
  const abuse = await AbuseModel.loadByIdWithReporter(parseInt(abuseId + '', 10))

  if (!abuse) {
    res.status(404)
       .json({ error: 'Abuse not found' })

    return false
  }

  res.locals.abuse = abuse
  return true
}

// ---------------------------------------------------------------------------

export {
  doesAbuseExist,
  doesVideoAbuseExist
}
