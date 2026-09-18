import { HttpStatusCode } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import cors from 'cors'
import express from 'express'
import { abuseRouter } from './abuse.js'
import { accountsRouter } from './accounts.js'
import { automaticTagRouter } from './automatic-tags.js'
import { blocklistRouter } from './blocklist.js'
import { bulkRouter } from './bulk.js'
import { clientConfigRouter } from './client-config.js'
import { configRouter, secondaryConfigRouter } from './config.js'
import { customPageRouter } from './custom-page.js'
import { jobsRouter } from './jobs.js'
import { metricsRouter } from './metrics.js'
import { oauthClientsRouter } from './oauth-clients.js'
import { overviewsRouter } from './overviews.js'
import { playerSettingsRouter, secondaryPlayerSettingsRouter } from './player-settings.js'
import { pluginRouter } from './plugins.js'
import { runnersRouter, secondaryRunnersRouter } from './runners/index.js'
import { searchRouter } from './search/index.js'
import { secondaryServerRouter, serverRouter } from './server/index.js'
import { secondaryUsersRouter, usersRouter } from './users/index.js'
import { videoChannelSyncRouter } from './video-channel-sync.js'
import { secondaryVideoChannelRouter, videoChannelRouter } from './video-channels/index.js'
import { secondaryVideoPlaylistRouter, videoPlaylistRouter } from './video-playlist.js'
import { secondaryVideosRouter, videosRouter } from './videos/index.js'
import { watchedWordsRouter } from './watched-words.js'

const logger = createLogger()

const corsMiddleware = cors({
  origin: '*',
  exposedHeaders: 'Retry-After'
})

const apiRouter = express.Router()

apiRouter.use(corsMiddleware)

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
apiRouter.use('/player-settings', playerSettingsRouter)
apiRouter.use('/plugins', pluginRouter)
apiRouter.use('/custom-pages', customPageRouter)
apiRouter.use('/blocklist', blocklistRouter)
apiRouter.use('/runners', runnersRouter)
apiRouter.use('/watched-words', watchedWordsRouter)
apiRouter.use('/automatic-tags', automaticTagRouter)
apiRouter.use('/client-config', clientConfigRouter)

apiRouter.use('/ping', pong)
apiRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

// API subset served by secondary processes
// Requests for any other endpoint must be routed to the primary by the reverse proxy or it will fail with a visible 400 error
const secondaryApiRouter = express.Router()

secondaryApiRouter.use(corsMiddleware)

secondaryApiRouter.use('/server', secondaryServerRouter)
secondaryApiRouter.use('/abuses', abuseRouter)
secondaryApiRouter.use('/bulk', bulkRouter)
secondaryApiRouter.use('/oauth-clients', oauthClientsRouter)
secondaryApiRouter.use('/config', secondaryConfigRouter)
secondaryApiRouter.use('/users', secondaryUsersRouter)
secondaryApiRouter.use('/accounts', accountsRouter)
secondaryApiRouter.use('/video-channels', secondaryVideoChannelRouter)
secondaryApiRouter.use('/video-channel-syncs', videoChannelSyncRouter)
secondaryApiRouter.use('/video-playlists', secondaryVideoPlaylistRouter)
secondaryApiRouter.use('/videos', secondaryVideosRouter)
secondaryApiRouter.use('/search', searchRouter)
secondaryApiRouter.use('/overviews', overviewsRouter)
secondaryApiRouter.use('/player-settings', secondaryPlayerSettingsRouter)
secondaryApiRouter.use('/custom-pages', customPageRouter)
secondaryApiRouter.use('/blocklist', blocklistRouter)
secondaryApiRouter.use('/runners', secondaryRunnersRouter)
secondaryApiRouter.use('/watched-words', watchedWordsRouter)
secondaryApiRouter.use('/automatic-tags', automaticTagRouter)
secondaryApiRouter.use('/client-config', clientConfigRouter)

secondaryApiRouter.use('/ping', pong)
secondaryApiRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export { apiRouter, secondaryApiRouter }

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
