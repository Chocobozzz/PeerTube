import cors from 'cors'
import express from 'express'
import { HttpNodeinfoDiasporaSoftwareNsSchema20, HttpStatusCode } from '@peertube/peertube-models'
import { CONFIG, isEmailEnabled } from '@server/initializers/config.js'
import { serveIndexHTML } from '@server/lib/html/client-html.js'
import { ServerConfigManager } from '@server/lib/server-config-manager.js'
import { CONSTRAINTS_FIELDS, DEFAULT_THEME_NAME, PEERTUBE_VERSION, ROUTE_CACHE_LIFETIME } from '../initializers/constants.js'
import { getThemeOrDefault } from '../lib/plugins/theme-utils.js'
import { cacheRoute } from '../middlewares/cache/cache.js'
import { apiRateLimiter, asyncMiddleware } from '../middlewares/index.js'
import { UserModel } from '../models/user/user.js'
import { VideoCommentModel } from '../models/video/video-comment.js'
import { VideoModel } from '../models/video/video.js'

const miscRouter = express.Router()

miscRouter.use(cors())

miscRouter.use('/nodeinfo/:version.json',
  apiRateLimiter,
  cacheRoute(ROUTE_CACHE_LIFETIME.NODEINFO),
  asyncMiddleware(generateNodeinfo)
)

// robots.txt service
miscRouter.get('/robots.txt',
  apiRateLimiter,
  cacheRoute(ROUTE_CACHE_LIFETIME.ROBOTS),
  (_, res: express.Response) => {
    res.type('text/plain')

    return res.send(CONFIG.INSTANCE.ROBOTS)
  }
)

miscRouter.all('/teapot',
  apiRateLimiter,
  getCup,
  asyncMiddleware(serveIndexHTML)
)

// security.txt service
miscRouter.get('/security.txt',
  apiRateLimiter,
  (_, res: express.Response) => {
    return res.redirect(HttpStatusCode.MOVED_PERMANENTLY_301, '/.well-known/security.txt')
  }
)

// ---------------------------------------------------------------------------

export {
  miscRouter
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
          web_videos: {
            enabled: CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED
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
