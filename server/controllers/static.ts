import * as cors from 'cors'
import * as express from 'express'
import { join } from 'path'
import { serveIndexHTML } from '@server/lib/client-html'
import { ServerConfigManager } from '@server/lib/server-config-manager'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { HttpNodeinfoDiasporaSoftwareNsSchema20 } from '../../shared/models/nodeinfo/nodeinfo.model'
import { root } from '../helpers/core-utils'
import { CONFIG, isEmailEnabled } from '../initializers/config'
import {
  CONSTRAINTS_FIELDS,
  DEFAULT_THEME_NAME,
  HLS_STREAMING_PLAYLIST_DIRECTORY,
  PEERTUBE_VERSION,
  ROUTE_CACHE_LIFETIME,
  STATIC_MAX_AGE,
  STATIC_PATHS,
  WEBSERVER
} from '../initializers/constants'
import { getThemeOrDefault } from '../lib/plugins/theme-utils'
import { asyncMiddleware } from '../middlewares'
import { cacheRoute } from '../middlewares/cache'
import { UserModel } from '../models/user/user'
import { VideoModel } from '../models/video/video'
import { VideoCommentModel } from '../models/video/video-comment'

const staticRouter = express.Router()

staticRouter.use(cors())

/*
  Cors is very important to let other servers access torrent and video files
*/

// FIXME: deprecated in 3.2, use lazy-statics instead
// Due to historical reasons, we can't really remove this controller
const torrentsPhysicalPath = CONFIG.STORAGE.TORRENTS_DIR
staticRouter.use(
  STATIC_PATHS.TORRENTS,
  express.static(torrentsPhysicalPath, { maxAge: 0 }) // Don't cache because we could regenerate the torrent file
)

// Videos path for webseed
staticRouter.use(
  STATIC_PATHS.WEBSEED,
  express.static(CONFIG.STORAGE.VIDEOS_DIR, { fallthrough: false }) // 404 because we don't have this video
)
staticRouter.use(
  STATIC_PATHS.REDUNDANCY,
  express.static(CONFIG.STORAGE.REDUNDANCY_DIR, { fallthrough: false }) // 404 because we don't have this video
)

// HLS
staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.HLS,
  cors(),
  express.static(HLS_STREAMING_PLAYLIST_DIRECTORY, { fallthrough: false }) // 404 if the file does not exist
)

// Thumbnails path for express
const thumbnailsPhysicalPath = CONFIG.STORAGE.THUMBNAILS_DIR
staticRouter.use(
  STATIC_PATHS.THUMBNAILS,
  express.static(thumbnailsPhysicalPath, { maxAge: STATIC_MAX_AGE.SERVER, fallthrough: false }) // 404 if the file does not exist
)

// robots.txt service
staticRouter.get('/robots.txt',
  asyncMiddleware(cacheRoute()(ROUTE_CACHE_LIFETIME.ROBOTS)),
  (_, res: express.Response) => {
    res.type('text/plain')
    return res.send(CONFIG.INSTANCE.ROBOTS)
  }
)

staticRouter.all('/teapot',
  getCup,
  asyncMiddleware(serveIndexHTML)
)

// security.txt service
staticRouter.get('/security.txt',
  (_, res: express.Response) => {
    return res.redirect(HttpStatusCode.MOVED_PERMANENTLY_301, '/.well-known/security.txt')
  }
)

staticRouter.get('/.well-known/security.txt',
  asyncMiddleware(cacheRoute()(ROUTE_CACHE_LIFETIME.SECURITYTXT)),
  (_, res: express.Response) => {
    res.type('text/plain')
    return res.send(CONFIG.INSTANCE.SECURITYTXT + CONFIG.INSTANCE.SECURITYTXT_CONTACT)
  }
)

// nodeinfo service
staticRouter.use('/.well-known/nodeinfo',
  asyncMiddleware(cacheRoute()(ROUTE_CACHE_LIFETIME.NODEINFO)),
  (_, res: express.Response) => {
    return res.json({
      links: [
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
          href: WEBSERVER.URL + '/nodeinfo/2.0.json'
        }
      ]
    })
  }
)
staticRouter.use('/nodeinfo/:version.json',
  asyncMiddleware(cacheRoute()(ROUTE_CACHE_LIFETIME.NODEINFO)),
  asyncMiddleware(generateNodeinfo)
)

// dnt-policy.txt service (see https://www.eff.org/dnt-policy)
staticRouter.use('/.well-known/dnt-policy.txt',
  asyncMiddleware(cacheRoute()(ROUTE_CACHE_LIFETIME.DNT_POLICY)),
  (_, res: express.Response) => {
    res.type('text/plain')

    return res.sendFile(join(root(), 'dist/server/static/dnt-policy/dnt-policy-1.0.txt'))
  }
)

// dnt service (see https://www.w3.org/TR/tracking-dnt/#status-resource)
staticRouter.use('/.well-known/dnt/',
  (_, res: express.Response) => {
    res.json({ tracking: 'N' })
  }
)

staticRouter.use('/.well-known/change-password',
  (_, res: express.Response) => {
    res.redirect('/my-account/settings')
  }
)

staticRouter.use('/.well-known/host-meta',
  (_, res: express.Response) => {
    res.type('application/xml')

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n' +
      `  <Link rel="lrdd" type="application/xrd+xml" template="${WEBSERVER.URL}/.well-known/webfinger?resource={uri}"/>\n` +
      '</XRD>'

    res.send(xml).end()
  }
)

// ---------------------------------------------------------------------------

export {
  staticRouter
}

// ---------------------------------------------------------------------------

async function generateNodeinfo (req: express.Request, res: express.Response) {
  const { totalVideos } = await VideoModel.getStats()
  const { totalLocalVideoComments } = await VideoCommentModel.getStats()
  const { totalUsers, totalMonthlyActiveUsers, totalHalfYearActiveUsers } = await UserModel.getStats()

  if (!req.params.version || req.params.version !== '2.0') {
    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Nodeinfo schema version not handled'
    })
  }

  const json = {
    version: '2.0',
    software: {
      name: 'peertube',
      version: PEERTUBE_VERSION
    },
    protocols: [
      'activitypub'
    ],
    services: {
      inbound: [],
      outbound: [
        'atom1.0',
        'rss2.0'
      ]
    },
    openRegistrations: CONFIG.SIGNUP.ENABLED,
    usage: {
      users: {
        total: totalUsers,
        activeMonth: totalMonthlyActiveUsers,
        activeHalfyear: totalHalfYearActiveUsers
      },
      localPosts: totalVideos,
      localComments: totalLocalVideoComments
    },
    metadata: {
      taxonomy: {
        postsName: 'Videos'
      },
      nodeName: CONFIG.INSTANCE.NAME,
      nodeDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
      nodeConfig: {
        search: {
          remoteUri: {
            users: CONFIG.SEARCH.REMOTE_URI.USERS,
            anonymous: CONFIG.SEARCH.REMOTE_URI.ANONYMOUS
          }
        },
        plugin: {
          registered: ServerConfigManager.Instance.getRegisteredPlugins()
        },
        theme: {
          registered: ServerConfigManager.Instance.getRegisteredThemes(),
          default: getThemeOrDefault(CONFIG.THEME.DEFAULT, DEFAULT_THEME_NAME)
        },
        email: {
          enabled: isEmailEnabled()
        },
        contactForm: {
          enabled: CONFIG.CONTACT_FORM.ENABLED
        },
        transcoding: {
          hls: {
            enabled: CONFIG.TRANSCODING.HLS.ENABLED
          },
          webtorrent: {
            enabled: CONFIG.TRANSCODING.WEBTORRENT.ENABLED
          },
          enabledResolutions: ServerConfigManager.Instance.getEnabledResolutions('vod')
        },
        live: {
          enabled: CONFIG.LIVE.ENABLED,
          transcoding: {
            enabled: CONFIG.LIVE.TRANSCODING.ENABLED,
            enabledResolutions: ServerConfigManager.Instance.getEnabledResolutions('live')
          }
        },
        import: {
          videos: {
            http: {
              enabled: CONFIG.IMPORT.VIDEOS.HTTP.ENABLED
            },
            torrent: {
              enabled: CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED
            }
          }
        },
        autoBlacklist: {
          videos: {
            ofUsers: {
              enabled: CONFIG.AUTO_BLACKLIST.VIDEOS.OF_USERS.ENABLED
            }
          }
        },
        avatar: {
          file: {
            size: {
              max: CONSTRAINTS_FIELDS.ACTORS.IMAGE.FILE_SIZE.max
            },
            extensions: CONSTRAINTS_FIELDS.ACTORS.IMAGE.EXTNAME
          }
        },
        video: {
          image: {
            extensions: CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME,
            size: {
              max: CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max
            }
          },
          file: {
            extensions: CONSTRAINTS_FIELDS.VIDEOS.EXTNAME
          }
        },
        videoCaption: {
          file: {
            size: {
              max: CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max
            },
            extensions: CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.EXTNAME
          }
        },
        user: {
          videoQuota: CONFIG.USER.VIDEO_QUOTA,
          videoQuotaDaily: CONFIG.USER.VIDEO_QUOTA_DAILY
        },
        trending: {
          videos: {
            intervalDays: CONFIG.TRENDING.VIDEOS.INTERVAL_DAYS
          }
        },
        tracker: {
          enabled: CONFIG.TRACKER.ENABLED
        }
      }
    }
  } as HttpNodeinfoDiasporaSoftwareNsSchema20

  res.contentType('application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.0#"')
      .send(json)
      .end()
}

function getCup (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.status(HttpStatusCode.I_AM_A_TEAPOT_418)
  res.setHeader('Accept-Additions', 'Non-Dairy;1,Sugar;1')
  res.setHeader('Safe', 'if-sepia-awake')

  return next()
}
