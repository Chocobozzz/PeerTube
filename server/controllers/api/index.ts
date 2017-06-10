import * as express from 'express'

import { badRequest } from '../../helpers'

import { clientsRouter } from './clients'
import { configRouter } from './config'
import { podsRouter } from './pods'
import { remoteRouter } from './remote'
import { requestsRouter } from './requests'
import { usersRouter } from './users'
import { videosRouter } from './videos'

const apiRouter = express.Router()

apiRouter.use('/clients', clientsRouter)
apiRouter.use('/config', configRouter)
apiRouter.use('/pods', podsRouter)
apiRouter.use('/remote', remoteRouter)
apiRouter.use('/requests', requestsRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/videos', videosRouter)
apiRouter.use('/ping', pong)
apiRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export { apiRouter }

// ---------------------------------------------------------------------------

function pong (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.send('pong').status(200).end()
}
