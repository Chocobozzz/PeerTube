import { HttpStatusCode } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import cors from 'cors'
import express from 'express'
import { abuseRouter } from './abuse.js'
import { accountsRouter } from './accounts.js'
import { automaticTagRouter } from './automatic-tags.js'
import { blocklistRouter } from './blocklist.js'
import { bulkRouter } from './bulk.js'
import { configRouter } from './config.js'
import { customPageRouter } from './custom-page.js'
import { jobsRouter } from './jobs.js'
import { metricsRouter } from './metrics.js'
import { oauthClientsRouter } from './oauth-clients.js'
import { overviewsRouter } from './overviews.js'
import { pluginRouter } from './plugins.js'
import { runnersRouter } from './runners/index.js'
import { searchRouter } from './search/index.js'
import { serverRouter } from './server/index.js'
import { usersRouter } from './users/index.js'
import { videoChannelSyncRouter } from './video-channel-sync.js'
import { videoChannelRouter } from './video-channel.js'
import { videoPlaylistRouter } from './video-playlist.js'
import { videosRouter } from './videos/index.js'
import { watchedWordsRouter } from './watched-words.js'

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
apiRouter.use('/watched-words', watchedWordsRouter)
apiRouter.use('/automatic-tags', automaticTagRouter)

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
