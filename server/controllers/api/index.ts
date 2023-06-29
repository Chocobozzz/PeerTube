import cors from 'cors'
import express from 'express'
import { logger } from '@server/helpers/logger'
import { HttpStatusCode } from '../../../shared/models'
import { abuseRouter } from './abuse'
import { accountsRouter } from './accounts'
import { blocklistRouter } from './blocklist'
import { bulkRouter } from './bulk'
import { configRouter } from './config'
import { customPageRouter } from './custom-page'
import { jobsRouter } from './jobs'
import { metricsRouter } from './metrics'
import { oauthClientsRouter } from './oauth-clients'
import { overviewsRouter } from './overviews'
import { pluginRouter } from './plugins'
import { runnersRouter } from './runners'
import { searchRouter } from './search'
import { serverRouter } from './server'
import { usersRouter } from './users'
import { videoChannelRouter } from './video-channel'
import { videoChannelSyncRouter } from './video-channel-sync'
import { videoPlaylistRouter } from './video-playlist'
import { videosRouter } from './videos'

const apiRouter = express.Router()

apiRouter.use(cors({
  origin: '*',
  exposedHeaders: 'Retry-After',
  credentials: true
}))

apiRouter.use('/server', serverRouter)
apiRouter.use('/abuses', abuseRouter)
apiRouter.use('/bulk', bulkRouter)
apiRouter.use('/oauth-clients', oauthClientsRouter)
apiRouter.use('/config', configRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/accounts', accountsRouter)
apiRouter.use('/video-channels', videoChannelRouter)
apiRouter.use('/video-channel-syncs', videoChannelSyncRouter)
apiRouter.use('/video-playlists', videoPlaylistRouter)
apiRouter.use('/videos', videosRouter)
apiRouter.use('/jobs', jobsRouter)
apiRouter.use('/metrics', metricsRouter)
apiRouter.use('/search', searchRouter)
apiRouter.use('/overviews', overviewsRouter)
apiRouter.use('/plugins', pluginRouter)
apiRouter.use('/custom-pages', customPageRouter)
apiRouter.use('/blocklist', blocklistRouter)
apiRouter.use('/runners', runnersRouter)

// apiRouter.use(apiRateLimiter)
apiRouter.use('/ping', pong)
apiRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export { apiRouter }

// ---------------------------------------------------------------------------

function pong (req: express.Request, res: express.Response) {
  return res.send('pong').status(HttpStatusCode.OK_200).end()
}

function badRequest (req: express.Request, res: express.Response) {
  logger.debug(`API express handler not found: bad PeerTube request for ${req.method} - ${req.originalUrl}`)

  return res.type('json')
    .status(HttpStatusCode.BAD_REQUEST_400)
    .end()
}
