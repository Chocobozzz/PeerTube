import { AbusePredefinedReasonsString } from '../../moderation/abuse/abuse-reason.model.js'
import { NSFWFlagString } from '../../videos/nsfw-flag.enum.js'

export interface ActivityIdentifierObject {
  identifier: string
  name: string
}

export interface ActivityIconObject {
  type: 'Image'
  url: string
  mediaType: string
  width: number
  height: number | null
}

// ---------------------------------------------------------------------------

export type ActivityVideoUrlObjectAttachment = {
  type: 'PropertyValue'
  name: 'ffprobe_codec_type'
  value: 'video' | 'audio'
} | {
  type: 'PropertyValue'
  name: 'peertube_format_flag'
  value: 'web-video' | 'fragmented'
}

export type ActivityVideoUrlObject = {
  type: 'Link'
  mediaType: 'video/mp4' | 'video/webm' | 'video/ogg' | 'audio/mp4'
  href: string
  height: number
  width: number | null
  size: number
  fps: number

  attachment: ActivityVideoUrlObjectAttachment[]
}

// ---------------------------------------------------------------------------

export type ActivityPlaylistSegmentHashesObject = {
  type: 'Link'
  name: 'sha256'
  mediaType: 'application/json'
  href: string
}

export type ActivityVideoFileMetadataUrlObject = {
  type: 'Link'
  rel: ['metadata', any]
  mediaType: 'application/json'
  height: number
  width: number | null
  href: string
  fps: number
}

export type ActivityCaptionUrlObject = {
  type: 'Link'
  mediaType: 'text/vtt'
  href: string
}

export type ActivityTrackerUrlObject = {
  type: 'Link'
  rel: ['tracker', 'websocket' | 'http']
  name: string
  href: string
}

export type ActivityStreamingPlaylistInfohashesObject = {
  type: 'Infohash'
  name: string
}

export type ActivityPlaylistUrlObject = {
  type: 'Link'
  mediaType: 'application/x-mpegURL'
  href: string
  tag?: ActivityTagObject[]
}

export type ActivityBitTorrentUrlObject = {
  type: 'Link'
  mediaType: 'application/x-bittorrent' | 'application/x-bittorrent;x-scheme-handler/magnet'
  href: string
  height: number
  width: number | null
  fps: number | null
}

export type ActivityMagnetUrlObject = {
  type: 'Link'
  mediaType: 'application/x-bittorrent;x-scheme-handler/magnet'
  href: string
  height: number
  width: number | null
  fps: number | null
}

export type ActivityHtmlUrlObject = {
  type: 'Link'
  mediaType: 'text/html'
  href: string
}

export interface ActivityHashTagObject {
  type: 'Hashtag'
  href?: string
  name: string
}

export interface ActivityMentionObject {
  type: 'Mention'
  href?: string
  name: string
}

export interface ActivityFlagReasonObject {
  type: 'Hashtag'
  name: AbusePredefinedReasonsString
}

export interface ActivitySensitiveTagObject {
  type: 'SensitiveTag'
  name: NSFWFlagString
}

export type ActivityTagObject =
  | ActivityPlaylistSegmentHashesObject
  | ActivityStreamingPlaylistInfohashesObject
  | ActivityVideoUrlObject
  | ActivityHashTagObject
  | ActivitySensitiveTagObject
  | ActivityMentionObject
  | ActivityBitTorrentUrlObject
  | ActivityMagnetUrlObject
  | ActivityVideoFileMetadataUrlObject

export type ActivityUrlObject =
  | ActivityVideoUrlObject
  | ActivityPlaylistUrlObject
  | ActivityBitTorrentUrlObject
  | ActivityMagnetUrlObject
  | ActivityHtmlUrlObject
  | ActivityVideoFileMetadataUrlObject
  | ActivityTrackerUrlObject
  | ActivityCaptionUrlObject

export type ActivityPubAttributedTo = { type: 'Group' | 'Person', id: string } | string

export interface ActivityTombstoneObject {
  '@context'?: any
  id: string
  url?: string
  type: 'Tombstone'
  name?: string
  formerType?: string
  inReplyTo?: string
  published: string
  updated: string
  deleted: string
}
