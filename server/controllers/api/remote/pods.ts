import * as express from 'express'

import { database as db } from '../../../initializers/database'
import {
  checkSignature,
  signatureValidator,
  setBodyHostPort,
  remotePodsAddValidator
} from '../../../middlewares'
import { sendOwnedVideosToPod } from '../../../lib'
import { getMyPublicCert, getFormattedObjects } from '../../../helpers'
import { CONFIG } from '../../../initializers'
import { PodInstance } from '../../../models'
import { PodSignature, Pod as FormattedPod } from '../../../../shared'

const remotePodsRouter = express.Router()

remotePodsRouter.post('/remove',
  signatureValidator,
  checkSignature,
  removePods
)

remotePodsRouter.post('/list', remotePodsList)

remotePodsRouter.post('/add',
  setBodyHostPort, // We need to modify the host before running the validator!
  remotePodsAddValidator,
  addPods
)

// ---------------------------------------------------------------------------

export {
  remotePodsRouter
}

// ---------------------------------------------------------------------------

function addPods (req: express.Request, res: express.Response, next: express.NextFunction) {
  const information = req.body

  const pod = db.Pod.build(information)
  pod.save()
     .then(podCreated => {
       return sendOwnedVideosToPod(podCreated.id)
     })
     .then(() => {
       return getMyPublicCert()
     })
     .then(cert => {
       return res.json({ cert: cert, email: CONFIG.ADMIN.EMAIL })
     })
     .catch(err => next(err))
}

function remotePodsList (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.Pod.list()
    .then(podsList => res.json(getFormattedObjects<FormattedPod, PodInstance>(podsList, podsList.length)))
    .catch(err => next(err))
}

function removePods (req: express.Request, res: express.Response, next: express.NextFunction) {
  const signature: PodSignature = req.body.signature
  const host = signature.host

  db.Pod.loadByHost(host)
    .then(pod => pod.destroy())
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}
