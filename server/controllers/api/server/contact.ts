import * as express from 'express'
import { asyncMiddleware, contactAdministratorValidator } from '../../../middlewares'
import { Redis } from '../../../lib/redis'
import { Emailer } from '../../../lib/emailer'
import { ContactForm } from '../../../../shared/models/server'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

const contactRouter = express.Router()

contactRouter.post('/contact',
  asyncMiddleware(contactAdministratorValidator),
  asyncMiddleware(contactAdministrator)
)

async function contactAdministrator (req: express.Request, res: express.Response) {
  const data = req.body as ContactForm

  await Emailer.Instance.addContactFormJob(data.fromEmail, data.fromName, data.subject, data.body)

  await Redis.Instance.setContactFormIp(req.ip)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

// ---------------------------------------------------------------------------

export {
  contactRouter
}
