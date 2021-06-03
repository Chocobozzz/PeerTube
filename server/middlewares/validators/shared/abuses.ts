import { Response } from 'express'
import { AbuseModel } from '@server/models/abuse/abuse'
import { HttpStatusCode } from '@shared/core-utils'

async function doesAbuseExist (abuseId: number | string, res: Response) {
  const abuse = await AbuseModel.loadByIdWithReporter(parseInt(abuseId + '', 10))

  if (!abuse) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Abuse not found'
    })

    return false
  }

  res.locals.abuse = abuse
  return true
}

// ---------------------------------------------------------------------------

export {
  doesAbuseExist
}
