import 'express-validator'
import * as express from 'express'

import { database as db } from '../initializers'
import {
  logger,
  checkSignature as peertubeCryptoCheckSignature
} from '../helpers'

function checkSignature (req: express.Request, res: express.Response, next: express.NextFunction) {
  const host = req.body.signature.host
  db.Pod.loadByHost(host)
    .then(pod => {
      if (pod === null) {
        logger.error('Unknown pod %s.', host)
        return res.sendStatus(403)
      }

      logger.debug('Checking signature from %s.', host)

      let signatureShouldBe
      // If there is data in the body the sender used it for its signature
      // If there is no data we just use its host as signature
      if (req.body.data) {
        signatureShouldBe = req.body.data
      } else {
        signatureShouldBe = host
      }

      const signatureOk = peertubeCryptoCheckSignature(pod.publicKey, signatureShouldBe, req.body.signature.signature)

      if (signatureOk === true) {
        res.locals.secure = {
          pod
        }

        return next()
      }

      logger.error('Signature is not okay in body for %s.', req.body.signature.host)
      return res.sendStatus(403)
    })
    .catch(err => {
      logger.error('Cannot get signed host in body.', { error: err })
      return res.sendStatus(500)
    })
}

// ---------------------------------------------------------------------------

export {
  checkSignature
}
