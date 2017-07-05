import * as express from 'express'

import { database as db } from '../../../initializers/database'
import { checkSignature, signatureValidator } from '../../../middlewares'

const remotePodsRouter = express.Router()

// Post because this is a secured request
remotePodsRouter.post('/remove',
  signatureValidator,
  checkSignature,
  removePods
)

// ---------------------------------------------------------------------------

export {
  remotePodsRouter
}

// ---------------------------------------------------------------------------

function removePods (req: express.Request, res: express.Response, next: express.NextFunction) {
  const host = req.body.signature.host

  db.Pod.loadByHost(host)
    .then(pod => {
      return pod.destroy()
    })
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}
