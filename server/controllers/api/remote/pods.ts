import * as express from 'express'

import { database as db } from '../../../initializers/database'
import { checkSignature, signatureValidator } from '../../../middlewares'
import { PodSignature } from '../../../../shared'

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
  const signature: PodSignature = req.body.signature
  const host = signature.host

  db.Pod.loadByHost(host)
    .then(pod => pod.destroy())
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}
