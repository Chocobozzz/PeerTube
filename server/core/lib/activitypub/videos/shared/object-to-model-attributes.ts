import { arrayify, maxBy, minBy } from '@peertube/peertube-core-utils'
import {
  ActivityHashTagObject,
  ActivityMagnetUrlObject,
  ActivityPlaylistSegmentHashesObject,
  ActivityPlaylistUrlObject,
  ActivityTagObject,
  ActivityUrlObject,
  ActivityVideoUrlObject,
  VideoObject,
  VideoPrivacy,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'
import { hasAPPublic } from '@server/helpers/activity-pub-utils.js'
import { isAPVideoFileUrlMetadataObject } from '@server/helpers/custom-validators/activitypub/videos.js'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { isVideoFileInfoHashValid } from '@server/helpers/custom-validators/videos.js'
import { generateImageFilename } from '@server/helpers/image-utils.js'
import { logger } from '@server/helpers/logger.js'
import { getExtFromMimetype } from '@server/helpers/video.js'
import { MIMETYPES, P2P_MEDIA_LOADER_PEER_VERSION, PREVIEWS_SIZE, THUMBNAILS_SIZE } from '@server/initializers/constants.js'
import { generateTorrentFileName } from '@server/lib/paths.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import { MChannelId, MStreamingPlaylistVideo, MVideo, MVideoId, isStreamingPlaylist } from '@server/types/models/index.js'
import { decode as magnetUriDecode } from 'magnet-uri'
import { basename, extname } from 'path'
import { getDurationFromActivityStream } from '../../activity.js'

export function getThumbnailFromIcons (videoObject: VideoObject) {
  let validIcons = videoObject.icon.filter(i => i.width > THUMBNAILS_SIZE.minWidth)
  // Fallback if there are not valid icons
  if (validIcons.length === 0) validIcons = videoObject.icon

  return minBy(validIcons, 'width')
}

export function getPreviewFromIcons (videoObject: VideoObject) {
  const validIcons = videoObject.icon.filter(i => i.width > PREVIEWS_SIZE.minWidth)

  return maxBy(validIcons, 'width')
}

export function getTagsFromObject (videoObject: VideoObject) {
  return videoObject.tag
    .filter(isAPHashTagObject)
    .map(t => t.name)
}

export function getFileAttributesFromUrl (
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo,
  urls: (ActivityTagObject | ActivityUrlObject)[]
) {
  const fileUrls = urls.filter(u => isAPVideoUrlObject(u)) as ActivityVideoUrlObject[]
  if (fileUrls.length === 0) return []

  const attributes: FilteredModelAttributes<VideoFileModel>[] = []
  for (const fileUrl of fileUrls) {
    // Fetch associated magnet uri
    const magnet = urls.filter(isAPMagnetUrlObject)
                       .find(u => u.height === fileUrl.height)

    if (!magnet) throw new Error('Cannot find associated magnet uri for file ' + fileUrl.href)

    const parsed = magnetUriDecode(magnet.href)
    if (!parsed || isVideoFileInfoHashValid(parsed.infoHash) === false) {
      throw new Error('Cannot parse magnet URI ' + magnet.href)
    }

    const torrentUrl = Array.isArray(parsed.xs)
      ? parsed.xs[0]
      : parsed.xs

    // Fetch associated metadata url, if any
    const metadata = urls.filter(isAPVideoFileUrlMetadataObject)
                         .find(u => {
                           return u.height === fileUrl.height &&
                             u.fps === fileUrl.fps &&
                             u.rel.includes(fileUrl.mediaType)
                         })

    const extname = getExtFromMimetype(MIMETYPES.VIDEO.MIMETYPE_EXT, fileUrl.mediaType)
    const resolution = fileUrl.height
    const videoId = isStreamingPlaylist(videoOrPlaylist) ? null : videoOrPlaylist.id
    const videoStreamingPlaylistId = isStreamingPlaylist(videoOrPlaylist) ? videoOrPlaylist.id : null

    const attribute = {
      extname,
      infoHash: parsed.infoHash,
      resolution,
      size: fileUrl.size,
      fps: fileUrl.fps || -1,
      metadataUrl: metadata?.href,

      width: fileUrl.width,
      height: fileUrl.height,

      // Use the name of the remote file because we don't proxify video file requests
      filename: basename(fileUrl.href),
      fileUrl: fileUrl.href,

      torrentUrl,
      // Use our own torrent name since we proxify torrent requests
      torrentFilename: generateTorrentFileName(videoOrPlaylist, resolution),

      // This is a video file owned by a video or by a streaming playlist
      videoId,
      videoStreamingPlaylistId
    }

    attributes.push(attribute)
  }

  return attributes
}

export function getStreamingPlaylistAttributesFromObject (video: MVideoId, videoObject: VideoObject) {
  const playlistUrls = videoObject.url.filter(u => isAPStreamingPlaylistUrlObject(u)) as ActivityPlaylistUrlObject[]
  if (playlistUrls.length === 0) return []

  const attributes: (FilteredModelAttributes<VideoStreamingPlaylistModel> & { tagAPObject?: ActivityTagObject[] })[] = []
  for (const playlistUrlObject of playlistUrls) {
    const segmentsSha256UrlObject = playlistUrlObject.tag.find(isAPPlaylistSegmentHashesUrlObject)

    const files: unknown[] = playlistUrlObject.tag.filter(u => isAPVideoUrlObject(u)) as ActivityVideoUrlObject[]

    if (!segmentsSha256UrlObject) {
      logger.warn('No segment sha256 URL found in AP playlist object.', { playlistUrl: playlistUrlObject })
      continue
    }

    const attribute = {
      type: VideoStreamingPlaylistType.HLS,

      playlistFilename: basename(playlistUrlObject.href),
      playlistUrl: playlistUrlObject.href,

      segmentsSha256Filename: basename(segmentsSha256UrlObject.href),
      segmentsSha256Url: segmentsSha256UrlObject.href,

      p2pMediaLoaderInfohashes: VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(playlistUrlObject.href, files),
      p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,
      videoId: video.id,

      tagAPObject: playlistUrlObject.tag
    }

    attributes.push(attribute)
  }

  return attributes
}

export function getLiveAttributesFromObject (video: MVideoId, videoObject: VideoObject) {
  return {
    saveReplay: videoObject.liveSaveReplay,
    permanentLive: videoObject.permanentLive,
    latencyMode: videoObject.latencyMode,
    videoId: video.id
  }
}

export function getCaptionAttributesFromObject (video: MVideoId, videoObject: VideoObject) {
  return videoObject.subtitleLanguage.map(c => ({
    videoId: video.id,
    filename: VideoCaptionModel.generateCaptionName(c.identifier),
    language: c.identifier,
    fileUrl: c.url
  }))
}

export function getStoryboardAttributeFromObject (video: MVideoId, videoObject: VideoObject) {
  if (!isArray(videoObject.preview)) return undefined

  const storyboard = videoObject.preview.find(p => p.rel.includes('storyboard'))
  if (!storyboard) return undefined

  const url = arrayify(storyboard.url).find(u => u.mediaType === 'image/jpeg')

  return {
    filename: generateImageFilename(extname(url.href)),
    totalHeight: url.height,
    totalWidth: url.width,
    spriteHeight: url.tileHeight,
    spriteWidth: url.tileWidth,
    spriteDuration: getDurationFromActivityStream(url.tileDuration),
    fileUrl: url.href,
    videoId: video.id
  }
}

export function getVideoAttributesFromObject (videoChannel: MChannelId, videoObject: VideoObject, to: string[] = []) {
  const privacy = hasAPPublic(to)
    ? VideoPrivacy.PUBLIC
    : VideoPrivacy.UNLISTED

  const language = videoObject.language?.identifier

  const category = videoObject.category
    ? parseInt(videoObject.category.identifier, 10)
    : undefined

  const licence = videoObject.licence
    ? parseInt(videoObject.licence.identifier, 10)
    : undefined

  const description = videoObject.content || null
  const support = videoObject.support || null

  return {
    name: videoObject.name,
    uuid: videoObject.uuid,
    url: videoObject.id,
    category,
    licence,
    language,
    description,
    support,
    nsfw: videoObject.sensitive,

    commentsPolicy: videoObject.commentsPolicy,

    downloadEnabled: videoObject.downloadEnabled,
    waitTranscoding: videoObject.waitTranscoding,
    isLive: videoObject.isLiveBroadcast,
    state: videoObject.state,
    aspectRatio: videoObject.aspectRatio,
    channelId: videoChannel.id,
    duration: getDurationFromActivityStream(videoObject.duration),
    createdAt: new Date(videoObject.published),
    publishedAt: new Date(videoObject.published),

    originallyPublishedAt: videoObject.originallyPublishedAt
      ? new Date(videoObject.originallyPublishedAt)
      : null,

    inputFileUpdatedAt: videoObject.uploadDate
      ? new Date(videoObject.uploadDate)
      : null,

    updatedAt: new Date(videoObject.updated),
    views: videoObject.views,
    remote: true,
    privacy
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isAPVideoUrlObject (url: any): url is ActivityVideoUrlObject {
  return !!MIMETYPES.AP_VIDEO.MIMETYPE_EXT[url.mediaType]
}

function isAPStreamingPlaylistUrlObject (url: any): url is ActivityPlaylistUrlObject {
  return url && url.mediaType === 'application/x-mpegURL'
}

function isAPPlaylistSegmentHashesUrlObject (tag: any): tag is ActivityPlaylistSegmentHashesObject {
  return tag && tag.name === 'sha256' && tag.type === 'Link' && tag.mediaType === 'application/json'
}

function isAPMagnetUrlObject (url: any): url is ActivityMagnetUrlObject {
  return url && url.mediaType === 'application/x-bittorrent;x-scheme-handler/magnet'
}

function isAPHashTagObject (url: any): url is ActivityHashTagObject {
  return url && url.type === 'Hashtag'
}
