import { maxBy, minBy } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import { basename } from 'path'
import { isAPVideoFileUrlMetadataObject } from '@server/helpers/custom-validators/activitypub/videos'
import { isVideoFileInfoHashValid } from '@server/helpers/custom-validators/videos'
import { logger } from '@server/helpers/logger'
import { getExtFromMimetype } from '@server/helpers/video'
import { ACTIVITY_PUB, MIMETYPES, P2P_MEDIA_LOADER_PEER_VERSION, PREVIEWS_SIZE, THUMBNAILS_SIZE } from '@server/initializers/constants'
import { generateTorrentFileName } from '@server/lib/video-paths'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { FilteredModelAttributes } from '@server/types'
import { MChannelId, MStreamingPlaylist, MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoId } from '@server/types/models'
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
} from '@shared/models'
import { VideoCaptionModel } from '@server/models/video/video-caption'

function getThumbnailFromIcons (videoObject: VideoObject) {
  let validIcons = videoObject.icon.filter(i => i.width > THUMBNAILS_SIZE.minWidth)
  // Fallback if there are not valid icons
  if (validIcons.length === 0) validIcons = videoObject.icon

  return minBy(validIcons, 'width')
}

function getPreviewFromIcons (videoObject: VideoObject) {
  const validIcons = videoObject.icon.filter(i => i.width > PREVIEWS_SIZE.minWidth)

  return maxBy(validIcons, 'width')
}

function getTagsFromObject (videoObject: VideoObject) {
  return videoObject.tag
    .filter(isAPHashTagObject)
    .map(t => t.name)
}

function getFileAttributesFromUrl (
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

    const parsed = magnetUtil.decode(magnet.href)
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
    const videoId = (videoOrPlaylist as MStreamingPlaylist).playlistUrl ? null : videoOrPlaylist.id
    const videoStreamingPlaylistId = (videoOrPlaylist as MStreamingPlaylist).playlistUrl ? videoOrPlaylist.id : null

    const attribute = {
      extname,
      infoHash: parsed.infoHash,
      resolution,
      size: fileUrl.size,
      fps: fileUrl.fps || -1,
      metadataUrl: metadata?.href,

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

function getStreamingPlaylistAttributesFromObject (video: MVideoId, videoObject: VideoObject, videoFiles: MVideoFile[]) {
  const playlistUrls = videoObject.url.filter(u => isAPStreamingPlaylistUrlObject(u)) as ActivityPlaylistUrlObject[]
  if (playlistUrls.length === 0) return []

  const attributes: (FilteredModelAttributes<VideoStreamingPlaylistModel> & { tagAPObject?: ActivityTagObject[] })[] = []
  for (const playlistUrlObject of playlistUrls) {
    const segmentsSha256UrlObject = playlistUrlObject.tag.find(isAPPlaylistSegmentHashesUrlObject)

    let files: unknown[] = playlistUrlObject.tag.filter(u => isAPVideoUrlObject(u)) as ActivityVideoUrlObject[]

    // FIXME: backward compatibility introduced in v2.1.0
    if (files.length === 0) files = videoFiles

    if (!segmentsSha256UrlObject) {
      logger.warn('No segment sha256 URL found in AP playlist object.', { playlistUrl: playlistUrlObject })
      continue
    }

    const attribute = {
      type: VideoStreamingPlaylistType.HLS,
      playlistUrl: playlistUrlObject.href,
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

function getLiveAttributesFromObject (video: MVideoId, videoObject: VideoObject) {
  return {
    saveReplay: videoObject.liveSaveReplay,
    permanentLive: videoObject.permanentLive,
    videoId: video.id
  }
}

function getCaptionAttributesFromObject (video: MVideoId, videoObject: VideoObject) {
  return videoObject.subtitleLanguage.map(c => ({
    videoId: video.id,
    filename: VideoCaptionModel.generateCaptionName(c.identifier),
    language: c.identifier,
    fileUrl: c.url
  }))
}

function getVideoAttributesFromObject (videoChannel: MChannelId, videoObject: VideoObject, to: string[] = []) {
  const privacy = to.includes(ACTIVITY_PUB.PUBLIC)
    ? VideoPrivacy.PUBLIC
    : VideoPrivacy.UNLISTED

  const duration = videoObject.duration.replace(/[^\d]+/, '')
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
    commentsEnabled: videoObject.commentsEnabled,
    downloadEnabled: videoObject.downloadEnabled,
    waitTranscoding: videoObject.waitTranscoding,
    isLive: videoObject.isLiveBroadcast,
    state: videoObject.state,
    channelId: videoChannel.id,
    duration: parseInt(duration, 10),
    createdAt: new Date(videoObject.published),
    publishedAt: new Date(videoObject.published),

    originallyPublishedAt: videoObject.originallyPublishedAt
      ? new Date(videoObject.originallyPublishedAt)
      : null,

    updatedAt: new Date(videoObject.updated),
    views: videoObject.views,
    likes: 0,
    dislikes: 0,
    remote: true,
    privacy
  }
}

// ---------------------------------------------------------------------------

export {
  getThumbnailFromIcons,
  getPreviewFromIcons,

  getTagsFromObject,

  getFileAttributesFromUrl,
  getStreamingPlaylistAttributesFromObject,

  getLiveAttributesFromObject,
  getCaptionAttributesFromObject,

  getVideoAttributesFromObject
}

// ---------------------------------------------------------------------------

function isAPVideoUrlObject (url: any): url is ActivityVideoUrlObject {
  const urlMediaType = url.mediaType

  return MIMETYPES.VIDEO.MIMETYPE_EXT[urlMediaType] && urlMediaType.startsWith('video/')
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
