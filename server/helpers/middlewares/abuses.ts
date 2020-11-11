import { Response } from 'express'
import { AbuseModel } from '../../models/abuse/abuse'

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
  doesAbuseExist
}
