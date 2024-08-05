import { arrayify, maxBy, minBy } from '@peertube/peertube-core-utils'
import {
  ActivityHashTagObject,
  ActivityMagnetUrlObject,
  ActivityPlaylistSegmentHashesObject,
  ActivityPlaylistUrlObject,
  ActivityTagObject,
  ActivityUrlObject,
  ActivityVideoUrlObject,
  VideoFileFormatFlag,
  VideoFileStream,
  VideoObject,
  VideoPrivacy,
  VideoResolution,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { hasAPPublic } from '@server/helpers/activity-pub-utils.js'
import { isAPVideoFileUrlMetadataObject } from '@server/helpers/custom-validators/activitypub/videos.js'
import { exists, isArray } from '@server/helpers/custom-validators/misc.js'
import { isVideoFileInfoHashValid } from '@server/helpers/custom-validators/videos.js'
import { generateImageFilename } from '@server/helpers/image-utils.js'
import { getExtFromMimetype } from '@server/helpers/video.js'
import { MIMETYPES, P2P_MEDIA_LOADER_PEER_VERSION, PREVIEWS_SIZE, THUMBNAILS_SIZE } from '@server/initializers/constants.js'
import { generateTorrentFileName } from '@server/lib/paths.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import { MChannelId, MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoId, isStreamingPlaylist } from '@server/types/models/index.js'
import { decode as magnetUriDecode } from 'magnet-uri'
import { basename, extname } from 'path'
import { getDurationFromActivityStream } from '../../activity.js'

export function getThumbnailFromIcons (videoObject: VideoObject) {
  let validIcons = videoObject.icon.filter(i => i.width > THUMBNAILS_SIZE.minRemoteWidth)
  // Fallback if there are not valid icons
  if (validIcons.length === 0) validIcons = videoObject.icon

  return minBy(validIcons, 'width')
}

export function getPreviewFromIcons (videoObject: VideoObject) {
  const validIcons = videoObject.icon.filter(i => i.width > PREVIEWS_SIZE.minRemoteWidth)

  return maxBy(validIcons, 'width')
}

export function getTagsFromObject (videoObject: VideoObject) {
  return videoObject.tag
    .filter(isAPHashTagObject)
    .map(t => t.name)
}

// ---------------------------------------------------------------------------

export function getFileAttributesFromUrl (
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo,
  urls: (ActivityTagObject | ActivityUrlObject)[]
) {
  const fileUrls = urls.filter(u => isAPVideoUrlObject(u))
  if (fileUrls.length === 0) return []

  const attributes: FilteredModelAttributes<VideoFileModel>[] = []
  for (const fileUrl of fileUrls) {
    // Fetch associated metadata url, if any
    const metadata = urls.filter(isAPVideoFileUrlMetadataObject)
                         .find(u => {
                           return u.height === fileUrl.height &&
                             u.fps === fileUrl.fps &&
                             u.rel.includes(fileUrl.mediaType)
                         })

    const extname = getExtFromMimetype(MIMETYPES.VIDEO.MIMETYPE_EXT, fileUrl.mediaType)
    const resolution = fileUrl.height

    const [ videoId, videoStreamingPlaylistId ] = isStreamingPlaylist(videoOrPlaylist)
      ? [ null, videoOrPlaylist.id ]
      : [ videoOrPlaylist.id, null ]

    const { torrentFilename, infoHash, torrentUrl } = getTorrentRelatedInfo({ videoOrPlaylist, urls, fileUrl })

    const attribute: Partial<AttributesOnly<MVideoFile>> = {
      extname,
      resolution,

      size: fileUrl.size,
      fps: exists(fileUrl.fps) && fileUrl.fps >= 0
        ? fileUrl.fps
        : -1,

      metadataUrl: metadata?.href,

      width: fileUrl.width,
      height: fileUrl.height,

      // Use the name of the remote file because we don't proxify video file requests
      filename: basename(fileUrl.href),
      fileUrl: fileUrl.href,

      infoHash,
      torrentFilename,
      torrentUrl,

      formatFlags: buildFileFormatFlags(fileUrl, isStreamingPlaylist(videoOrPlaylist)),
      streams: buildFileStreams(fileUrl, resolution),

      // This is a video file owned by a video or by a streaming playlist
      videoId,
      videoStreamingPlaylistId
    }

    attributes.push(attribute)
  }

  return attributes
}

function buildFileFormatFlags (fileUrl: ActivityVideoUrlObject, isStreamingPlaylist: boolean) {
  const attachment = fileUrl.attachment || []

  const formatHints = attachment.filter(a => a.type === 'PropertyValue' && a.name === 'peertube_format_flag')
  if (formatHints.length === 0) {
    return isStreamingPlaylist
      ? VideoFileFormatFlag.FRAGMENTED
      : VideoFileFormatFlag.WEB_VIDEO
  }

  let formatFlags = VideoFileFormatFlag.NONE

  for (const hint of formatHints) {
    if (hint.value === 'fragmented') formatFlags |= VideoFileFormatFlag.FRAGMENTED
    else if (hint.value === 'web-video') formatFlags |= VideoFileFormatFlag.WEB_VIDEO
  }

  return formatFlags
}

function buildFileStreams (fileUrl: ActivityVideoUrlObject, resolution: number) {
  const attachment = fileUrl.attachment || []

  const formatHints = attachment.filter(a => a.type === 'PropertyValue' && a.name === 'ffprobe_codec_type')

  if (formatHints.length === 0) {
    if (resolution === VideoResolution.H_NOVIDEO) return VideoFileStream.AUDIO

    return VideoFileStream.VIDEO | VideoFileStream.AUDIO
  }

  let streams = VideoFileStream.NONE

  for (const hint of formatHints) {
    if (hint.value === 'audio') streams |= VideoFileStream.AUDIO
    else if (hint.value === 'video') streams |= VideoFileStream.VIDEO
  }

  return streams
}

// ---------------------------------------------------------------------------

export function getStreamingPlaylistAttributesFromObject (video: MVideoId, videoObject: VideoObject) {
  const playlistUrls = videoObject.url.filter(u => isAPStreamingPlaylistUrlObject(u))
  if (playlistUrls.length === 0) return []

  const attributes: (FilteredModelAttributes<VideoStreamingPlaylistModel> & { tagAPObject?: ActivityTagObject[] })[] = []
  for (const playlistUrlObject of playlistUrls) {
    const segmentsSha256UrlObject = playlistUrlObject.tag.find(isAPPlaylistSegmentHashesUrlObject)

    const files: unknown[] = playlistUrlObject.tag.filter(u => isAPVideoUrlObject(u))

    const attribute = {
      type: VideoStreamingPlaylistType.HLS,

      playlistFilename: basename(playlistUrlObject.href),
      playlistUrl: playlistUrlObject.href,

      segmentsSha256Filename: segmentsSha256UrlObject
        ? basename(segmentsSha256UrlObject.href)
        : null,

      segmentsSha256Url: segmentsSha256UrlObject?.href ?? null,

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
    automaticallyGenerated: c.automaticallyGenerated === true,
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

function getTorrentRelatedInfo (options: {
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo
  urls: (ActivityTagObject | ActivityUrlObject)[]
  fileUrl: ActivityVideoUrlObject
}) {
  const { urls, fileUrl, videoOrPlaylist } = options

  // Fetch associated magnet uri
  const magnet = urls.filter(isAPMagnetUrlObject)
    .find(u => u.height === fileUrl.height)

  if (!magnet) {
    return {
      torrentUrl: null,
      torrentFilename: null,
      infoHash: null
    }
  }

  const magnetParsed = magnetUriDecode(magnet.href)
  if (magnetParsed && isVideoFileInfoHashValid(magnetParsed.infoHash) === false) {
    throw new Error('Info hash is not valid in magnet URI ' + magnet.href)
  }

  const torrentUrl = Array.isArray(magnetParsed.xs)
    ? magnetParsed.xs[0]
    : magnetParsed.xs

  return {
    torrentUrl,

    // Use our own torrent name since we proxify torrent requests
    torrentFilename: generateTorrentFileName(videoOrPlaylist, fileUrl.height),

    infoHash: magnetParsed.infoHash
  }
}
