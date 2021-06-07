import * as express from 'express'
import { OAuthClientLocal } from '../../../shared'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { asyncMiddleware, openapiOperationDoc } from '../../middlewares'
import { OAuthClientModel } from '../../models/oauth/oauth-client'

const oauthClientsRouter = express.Router()

oauthClientsRouter.get('/local',
  openapiOperationDoc({ operationId: 'getOAuthClient' }),
  asyncMiddleware(getLocalClient)
)

// Get the client credentials for the PeerTube front end
async function getLocalClient (req: express.Request, res: express.Response, next: express.NextFunction) {
  const serverHostname = CONFIG.WEBSERVER.HOSTNAME
  const serverPort = CONFIG.WEBSERVER.PORT
  let headerHostShouldBe = serverHostname
  if (serverPort !== 80 && serverPort !== 443) {
    headerHostShouldBe += ':' + serverPort
  }

  // Don't make this check if this is a test instance
  if (process.env.NODE_ENV !== 'test' && req.get('host') !== headerHostShouldBe) {
    logger.info('Getting client tokens for host %s is forbidden (expected %s).', req.get('host'), headerHostShouldBe)
    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: `Getting client tokens for host ${req.get('host')} is forbidden`
    })
  }

  const client = await OAuthClientModel.loadFirstClient()
  if (!client) throw new Error('No client available.')

  const json: OAuthClientLocal = {
    client_id: client.clientId,
    client_secret: client.clientSecret
  }
  return res.json(json)
}

// ---------------------------------------------------------------------------

export {
  oauthClientsRouter
}
