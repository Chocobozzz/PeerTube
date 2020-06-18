import * as cors from 'cors'
import * as express from 'express'
import {
  CONSTRAINTS_FIELDS,
  DEFAULT_THEME_NAME,
  HLS_STREAMING_PLAYLIST_DIRECTORY,
  PEERTUBE_VERSION,
  ROUTE_CACHE_LIFETIME,
  STATIC_DOWNLOAD_PATHS,
  STATIC_MAX_AGE,
  STATIC_PATHS,
  WEBSERVER
} from '../initializers/constants'
import { cacheRoute } from '../middlewares/cache'
import { asyncMiddleware, videosDownloadValidator } from '../middlewares'
import { VideoModel } from '../models/video/video'
import { UserModel } from '../models/account/user'
import { VideoCommentModel } from '../models/video/video-comment'
import { HttpNodeinfoDiasporaSoftwareNsSchema20 } from '../../shared/models/nodeinfo'
import { join } from 'path'
import { root } from '../helpers/core-utils'
import { CONFIG, isEmailEnabled } from '../initializers/config'
import { getPreview, getVideoCaption } from './lazy-static'
import { VideoStreamingPlaylistType } from '@shared/models/videos/video-streaming-playlist.type'
import { MVideoFile, MVideoFullLight } from '@server/types/models'
import { getTorrentFilePath, getVideoFilePath } from '@server/lib/video-paths'
import { getThemeOrDefault } from '../lib/plugins/theme-utils'
import { getEnabledResolutions, getRegisteredPlugins, getRegisteredThemes } from '@server/controllers/api/config'

const staticRouter = express.Router()

staticRouter.use(cors())

/*
  Cors is very important to let other servers access torrent and video files
*/

const torrentsPhysicalPath = CONFIG.STORAGE.TORRENTS_DIR
staticRouter.use(
  STATIC_PATHS.TORRENTS,
  cors(),
  express.static(torrentsPhysicalPath, { maxAge: 0 }) // Don't cache because we could regenerate the torrent file
)
staticRouter.use(
  STATIC_DOWNLOAD_PATHS.TORRENTS + ':id-:resolution([0-9]+).torrent',
  asyncMiddleware(videosDownloadValidator),
  downloadTorrent
)
staticRouter.use(
  STATIC_DOWNLOAD_PATHS.TORRENTS + ':id-:resolution([0-9]+)-hls.torrent',
  asyncMiddleware(videosDownloadValidator),
  downloadHLSVideoFileTorrent
)

// Videos path for webseeding
staticRouter.use(
  STATIC_PATHS.WEBSEED,
  cors(),
  express.static(CONFIG.STORAGE.VIDEOS_DIR, { fallthrough: false }) // 404 because we don't have this video
)
staticRouter.use(
  STATIC_PATHS.REDUNDANCY,
  cors(),
  express.static(CONFIG.STORAGE.REDUNDANCY_DIR, { fallthrough: false }) // 404 because we don't have this video
)

staticRouter.use(
  STATIC_DOWNLOAD_PATHS.VIDEOS + ':id-:resolution([0-9]+).:extension',
  asyncMiddleware(videosDownloadValidator),
  downloadVideoFile
)

staticRouter.use(
  STATIC_DOWNLOAD_PATHS.HLS_VIDEOS + ':id-:resolution([0-9]+)-fragmented.:extension',
  asyncMiddleware(videosDownloadValidator),
  downloadHLSVideoFile
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

// DEPRECATED: use lazy-static route instead
const avatarsPhysicalPath = CONFIG.STORAGE.AVATARS_DIR
staticRouter.use(
  STATIC_PATHS.AVATARS,
  express.static(avatarsPhysicalPath, { maxAge: STATIC_MAX_AGE.SERVER, fallthrough: false }) // 404 if the file does not exist
)

// DEPRECATED: use lazy-static route instead
staticRouter.use(
  STATIC_PATHS.PREVIEWS + ':uuid.jpg',
  asyncMiddleware(getPreview)
)

// DEPRECATED: use lazy-static route instead
staticRouter.use(
  STATIC_PATHS.VIDEO_CAPTIONS + ':videoId-:captionLanguage([a-z]+).vtt',
  asyncMiddleware(getVideoCaption)
)

// robots.txt service
staticRouter.get('/robots.txt',
  asyncMiddleware(cacheRoute()(ROUTE_CACHE_LIFETIME.ROBOTS)),
  (_, res: express.Response) => {
    res.type('text/plain')
    return res.send(CONFIG.INSTANCE.ROBOTS)
  }
)

// security.txt service
staticRouter.get('/security.txt',
  (_, res: express.Response) => {
    return res.redirect(301, '/.well-known/security.txt')
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
  const { totalUsers } = await UserModel.getStats()
  let json = {}

  if (req.params.version && (req.params.version === '2.0')) {
    json = {
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
          total: totalUsers
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
            registered: getRegisteredPlugins()
          },
          theme: {
            registered: getRegisteredThemes(),
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
            enabledResolutions: getEnabledResolutions()
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
                max: CONSTRAINTS_FIELDS.ACTORS.AVATAR.FILE_SIZE.max
              },
              extensions: CONSTRAINTS_FIELDS.ACTORS.AVATAR.EXTNAME
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
  } else {
    json = { error: 'Nodeinfo schema version not handled' }
    res.status(404)
  }

  return res.send(json).end()
}

function downloadTorrent (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  const videoFile = getVideoFile(req, video.VideoFiles)
  if (!videoFile) return res.status(404).end()

  return res.download(getTorrentFilePath(video, videoFile), `${video.name}-${videoFile.resolution}p.torrent`)
}

function downloadHLSVideoFileTorrent (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  const playlist = getHLSPlaylist(video)
  if (!playlist) return res.status(404).end

  const videoFile = getVideoFile(req, playlist.VideoFiles)
  if (!videoFile) return res.status(404).end()

  return res.download(getTorrentFilePath(playlist, videoFile), `${video.name}-${videoFile.resolution}p-hls.torrent`)
}

function downloadVideoFile (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  const videoFile = getVideoFile(req, video.VideoFiles)
  if (!videoFile) return res.status(404).end()

  return res.download(getVideoFilePath(video, videoFile), `${video.name}-${videoFile.resolution}p${videoFile.extname}`)
}

function downloadHLSVideoFile (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const playlist = getHLSPlaylist(video)
  if (!playlist) return res.status(404).end

  const videoFile = getVideoFile(req, playlist.VideoFiles)
  if (!videoFile) return res.status(404).end()

  const filename = `${video.name}-${videoFile.resolution}p-${playlist.getStringType()}${videoFile.extname}`
  return res.download(getVideoFilePath(playlist, videoFile), filename)
}

function getVideoFile (req: express.Request, files: MVideoFile[]) {
  const resolution = parseInt(req.params.resolution, 10)
  return files.find(f => f.resolution === resolution)
}

function getHLSPlaylist (video: MVideoFullLight) {
  const playlist = video.VideoStreamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
  if (!playlist) return undefined

  return Object.assign(playlist, { Video: video })
}
