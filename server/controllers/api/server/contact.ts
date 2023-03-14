import { logger } from '@server/helpers/logger'
import express from 'express'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { ContactForm } from '../../../../shared/models/server'
import { Emailer } from '../../../lib/emailer'
import { Redis } from '../../../lib/redis'
import { asyncMiddleware, contactAdministratorValidator } from '../../../middlewares'

const contactRouter = express.Router()

contactRouter.post('/contact',
  asyncMiddleware(contactAdministratorValidator),
  asyncMiddleware(contactAdministrator)
)

async function contactAdministrator (req: express.Request, res: express.Response) {
  const data = req.body as ContactForm

  Emailer.Instance.addContactFormJob(data.fromEmail, data.fromName, data.subject, data.body)

  try {
    await Redis.Instance.setContactFormIp(req.ip)
  } catch (err) {
    logger.error(err)
  }

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

// ---------------------------------------------------------------------------

export {
  contactRouter
}
