import { Response } from 'express'
import { AbuseModel } from '../../models/abuse/abuse'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

async function doesAbuseExist (abuseId: number | string, res: Response) {
  const abuse = await AbuseModel.loadByIdWithReporter(parseInt(abuseId + '', 10))

  if (!abuse) {
    res.status(HttpStatusCode.NOT_FOUND_404)
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
