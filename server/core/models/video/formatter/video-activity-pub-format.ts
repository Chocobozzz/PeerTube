import {
  ActivityIconObject,
  ActivityPlaylistUrlObject,
  ActivityPubStoryboard,
  ActivityTagObject,
  ActivityTrackerUrlObject,
  ActivityUrlObject, VideoCommentPolicy, VideoObject
} from '@peertube/peertube-models'
import { getAPPublicValue } from '@server/helpers/activity-pub-utils.js'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { generateMagnetUri } from '@server/helpers/webtorrent.js'
import { getActivityStreamDuration } from '@server/lib/activitypub/activity.js'
import { getLocalVideoFileMetadataUrl } from '@server/lib/video-urls.js'
import { WEBSERVER } from '../../../initializers/constants.js'
import {
  getLocalVideoChaptersActivityPubUrl,
  getLocalVideoCommentsActivityPubUrl,
  getLocalVideoDislikesActivityPubUrl,
  getLocalVideoLikesActivityPubUrl,
  getLocalVideoSharesActivityPubUrl
} from '../../../lib/activitypub/url.js'
import { MStreamingPlaylistFiles, MUserId, MVideo, MVideoAP, MVideoFile } from '../../../types/models/index.js'
import { sortByResolutionDesc } from './shared/index.js'
import { getCategoryLabel, getLanguageLabel, getLicenceLabel } from './video-api-format.js'

export function videoModelToActivityPubObject (video: MVideoAP): VideoObject {
  const language = video.language
    ? { identifier: video.language, name: getLanguageLabel(video.language) }
    : undefined

  const category = video.category
    ? { identifier: video.category + '', name: getCategoryLabel(video.category) }
    : undefined

  const licence = video.licence
    ? { identifier: video.licence + '', name: getLicenceLabel(video.licence) }
    : undefined

  const url: ActivityUrlObject[] = [
    // HTML url should be the first element in the array so Mastodon correctly displays the embed
    {
      type: 'Link',
      mediaType: 'text/html',
      href: WEBSERVER.URL + '/videos/watch/' + video.uuid
    } as ActivityUrlObject,

    ...buildVideoFileUrls({ video, files: video.VideoFiles }),

    ...buildStreamingPlaylistUrls(video),

    ...buildTrackerUrls(video)
  ]

  return {
    type: 'Video' as 'Video',
    id: video.url,
    name: video.name,
    duration: getActivityStreamDuration(video.duration),
    uuid: video.uuid,
    category,
    licence,
    language,
    views: video.views,
    sensitive: video.nsfw,
    waitTranscoding: video.waitTranscoding,

    state: video.state,

    commentsEnabled: video.commentsPolicy !== VideoCommentPolicy.DISABLED,
    canReply: video.commentsPolicy === VideoCommentPolicy.ENABLED
      ? null
      : getAPPublicValue(), // Requires approval

    commentsPolicy: video.commentsPolicy,

    downloadEnabled: video.downloadEnabled,
    published: video.publishedAt.toISOString(),

    originallyPublishedAt: video.originallyPublishedAt
      ? video.originallyPublishedAt.toISOString()
      : null,

    updated: video.updatedAt.toISOString(),

    uploadDate: video.inputFileUpdatedAt?.toISOString(),

    tag: buildTags(video),

    mediaType: 'text/markdown',
    content: video.description,
    support: video.support,

    subtitleLanguage: buildSubtitleLanguage(video),

    icon: buildIcon(video),

    preview: buildPreviewAPAttribute(video),

    aspectRatio: video.aspectRatio,

    url,

    likes: getLocalVideoLikesActivityPubUrl(video),
    dislikes: getLocalVideoDislikesActivityPubUrl(video),
    shares: getLocalVideoSharesActivityPubUrl(video),
    comments: getLocalVideoCommentsActivityPubUrl(video),
    hasParts: getLocalVideoChaptersActivityPubUrl(video),

    attributedTo: [
      {
        type: 'Person',
        id: video.VideoChannel.Account.Actor.url
      },
      {
        type: 'Group',
        id: video.VideoChannel.Actor.url
      }
    ],

    ...buildLiveAPAttributes(video)
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildLiveAPAttributes (video: MVideoAP) {
  if (!video.isLive) {
    return {
      isLiveBroadcast: false,
      liveSaveReplay: null,
      permanentLive: null,
      latencyMode: null
    }
  }

  return {
    isLiveBroadcast: true,
    liveSaveReplay: video.VideoLive.saveReplay,
    permanentLive: video.VideoLive.permanentLive,
    latencyMode: video.VideoLive.latencyMode
  }
}

function buildPreviewAPAttribute (video: MVideoAP): ActivityPubStoryboard[] {
  if (!video.Storyboard) return undefined

  const storyboard = video.Storyboard

  return [
    {
      type: 'Image',
      rel: [ 'storyboard' ],
      url: [
        {
          mediaType: 'image/jpeg',

          href: storyboard.getOriginFileUrl(video),

          width: storyboard.totalWidth,
          height: storyboard.totalHeight,

          tileWidth: storyboard.spriteWidth,
          tileHeight: storyboard.spriteHeight,
          tileDuration: getActivityStreamDuration(storyboard.spriteDuration)
        }
      ]
    }
  ]
}

function buildVideoFileUrls (options: {
  video: MVideo
  files: MVideoFile[]
  user?: MUserId
}): ActivityUrlObject[] {
  const { video, files } = options

  if (!isArray(files)) return []

  const urls: ActivityUrlObject[] = []

  const trackerUrls = video.getTrackerUrls()
  const sortedFiles = files
    .filter(f => !f.isLive())
    .sort(sortByResolutionDesc)

  for (const file of sortedFiles) {
    const fileAP = file.toActivityPubObject(video)
    urls.push(fileAP)

    urls.push({
      type: 'Link',
      rel: [ 'metadata', fileAP.mediaType ],
      mediaType: 'application/json' as 'application/json',
      href: getLocalVideoFileMetadataUrl(video, file),
      height: file.height || file.resolution,
      width: file.width,
      fps: file.fps
    })

    if (file.hasTorrent()) {
      urls.push({
        type: 'Link',
        mediaType: 'application/x-bittorrent' as 'application/x-bittorrent',
        href: file.getTorrentUrl(),
        height: file.height || file.resolution,
        width: file.width,
        fps: file.fps
      })

      urls.push({
        type: 'Link',
        mediaType: 'application/x-bittorrent;x-scheme-handler/magnet' as 'application/x-bittorrent;x-scheme-handler/magnet',
        href: generateMagnetUri(video, file, trackerUrls),
        height: file.height || file.resolution,
        width: file.width,
        fps: file.fps
      })
    }
  }

  return urls
}

// ---------------------------------------------------------------------------

function buildStreamingPlaylistUrls (video: MVideoAP): ActivityPlaylistUrlObject[] {
  if (!isArray(video.VideoStreamingPlaylists)) return []

  return video.VideoStreamingPlaylists
    .map(playlist => ({
      type: 'Link',
      mediaType: 'application/x-mpegURL' as 'application/x-mpegURL',
      href: playlist.getMasterPlaylistUrl(video),
      tag: buildStreamingPlaylistTags(video, playlist)
    }))
}

function buildStreamingPlaylistTags (video: MVideoAP, playlist: MStreamingPlaylistFiles) {
  return [
    ...playlist.p2pMediaLoaderInfohashes.map(i => ({ type: 'Infohash' as 'Infohash', name: i })),

    {
      type: 'Link',
      name: 'sha256',
      mediaType: 'application/json' as 'application/json',
      href: playlist.getSha256SegmentsUrl(video)
    },

    ...buildVideoFileUrls({ video, files: playlist.VideoFiles })
  ] as ActivityTagObject[]
}

// ---------------------------------------------------------------------------

function buildTrackerUrls (video: MVideoAP): ActivityTrackerUrlObject[] {
  return video.getTrackerUrls()
    .map(trackerUrl => {
      const rel2 = trackerUrl.startsWith('http')
        ? 'http'
        : 'websocket'

      return {
        type: 'Link',
        name: `tracker-${rel2}`,
        rel: [ 'tracker', rel2 ],
        href: trackerUrl
      }
    })
}

// ---------------------------------------------------------------------------

function buildTags (video: MVideoAP) {
  if (!isArray(video.Tags)) return []

  return video.Tags.map(t => ({
    type: 'Hashtag' as 'Hashtag',
    name: t.name
  }))
}

function buildIcon (video: MVideoAP): ActivityIconObject[] {
  return [ video.getMiniature(), video.getPreview() ]
    .map(i => i.toActivityPubObject(video))
}

function buildSubtitleLanguage (video: MVideoAP) {
  if (!isArray(video.VideoCaptions)) return []

  return video.VideoCaptions
    .map(caption => caption.toActivityPubObject(video))
}
