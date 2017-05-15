const db = require('../initializers/database')
const logger = require('../helpers/logger')
const peertubeCrypto = require('../helpers/peertube-crypto')

function checkSignature (req, res, next) {
  const host = req.body.signature.host
  db.Pod.loadByHost(host, function (err, pod) {
    if (err) {
      logger.error('Cannot get signed host in body.', { error: err })
      return res.sendStatus(500)
    }

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

    const signatureOk = peertubeCrypto.checkSignature(pod.publicKey, signatureShouldBe, req.body.signature.signature)

    if (signatureOk === true) {
      res.locals.secure = {
        pod
      }

      return next()
    }

    logger.error('Signature is not okay in body for %s.', req.body.signature.host)
    return res.sendStatus(403)
  })
}

// ---------------------------------------------------------------------------

export {
  checkSignature
}
