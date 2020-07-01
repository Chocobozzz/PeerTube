import * as cors from 'cors'
import * as express from 'express'
import * as RateLimit from 'express-rate-limit'
import { badRequest } from '../../helpers/express-utils'
import { CONFIG } from '../../initializers/config'
import { abuseRouter } from './abuse'
import { accountsRouter } from './accounts'
import { bulkRouter } from './bulk'
import { configRouter } from './config'
import { jobsRouter } from './jobs'
import { oauthClientsRouter } from './oauth-clients'
import { overviewsRouter } from './overviews'
import { pluginRouter } from './plugins'
import { searchRouter } from './search'
import { serverRouter } from './server'
import { usersRouter } from './users'
import { videoChannelRouter } from './video-channel'
import { videoPlaylistRouter } from './video-playlist'
import { videosRouter } from './videos'

const apiRouter = express.Router()

apiRouter.use(cors({
  origin: '*',
  exposedHeaders: 'Retry-After',
  credentials: true
}))

const apiRateLimiter = RateLimit({
  windowMs: CONFIG.RATES_LIMIT.API.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.API.MAX
})
apiRouter.use(apiRateLimiter)

apiRouter.use('/server', serverRouter)
apiRouter.use('/abuses', abuseRouter)
apiRouter.use('/bulk', bulkRouter)
apiRouter.use('/oauth-clients', oauthClientsRouter)
apiRouter.use('/config', configRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/accounts', accountsRouter)
apiRouter.use('/video-channels', videoChannelRouter)
apiRouter.use('/video-playlists', videoPlaylistRouter)
apiRouter.use('/videos', videosRouter)
apiRouter.use('/jobs', jobsRouter)
apiRouter.use('/search', searchRouter)
apiRouter.use('/overviews', overviewsRouter)
apiRouter.use('/plugins', pluginRouter)
apiRouter.use('/ping', pong)
apiRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export { apiRouter }

// ---------------------------------------------------------------------------

function pong (req: express.Request, res: express.Response) {
  return res.send('pong').status(200).end()
}
