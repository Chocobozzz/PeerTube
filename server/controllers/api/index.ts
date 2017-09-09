import * as express from 'express'

import { badRequest } from '../../helpers'

import { oauthClientsRouter } from './oauth-clients'
import { configRouter } from './config'
import { podsRouter } from './pods'
import { remoteRouter } from './remote'
import { requestSchedulerRouter } from './request-schedulers'
import { usersRouter } from './users'
import { videosRouter } from './videos'
import { blacklistsRouter } from './blacklists'

const apiRouter = express.Router()

apiRouter.use('/oauth-clients', oauthClientsRouter)
apiRouter.use('/config', configRouter)
apiRouter.use('/pods', podsRouter)
apiRouter.use('/remote', remoteRouter)
apiRouter.use('/request-schedulers', requestSchedulerRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/videos', videosRouter)
apiRouter.use('/blacklist', blacklistsRouter)
apiRouter.use('/ping', pong)
apiRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export { apiRouter }

// ---------------------------------------------------------------------------

function pong (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.send('pong').status(200).end()
}
