import * as express from 'express'
import { badRequest } from '../../helpers/utils'
import { configRouter } from './config'
import { jobsRouter } from './jobs'
import { oauthClientsRouter } from './oauth-clients'
import { serverRouter } from './server'
import { usersRouter } from './users'
import { videosRouter } from './videos'

const apiRouter = express.Router()

apiRouter.use('/server', serverRouter)
apiRouter.use('/oauth-clients', oauthClientsRouter)
apiRouter.use('/config', configRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/videos', videosRouter)
apiRouter.use('/jobs', jobsRouter)
apiRouter.use('/ping', pong)
apiRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export { apiRouter }

// ---------------------------------------------------------------------------

function pong (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.send('pong').status(200).end()
}
