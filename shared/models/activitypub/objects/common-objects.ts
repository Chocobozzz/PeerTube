import { AbusePredefinedReasonsString } from '@shared/models'

export interface ActivityIdentifierObject {
  identifier: string
  name: string
  url?: string
}

export interface ActivityIconObject {
  type: 'Image'
  url: string
  mediaType: 'image/jpeg' | 'image/png'
  width?: number
  height?: number
}

export type ActivityVideoUrlObject = {
  type: 'Link'
  mediaType: 'video/mp4' | 'video/webm' | 'video/ogg'
  href: string
  height: number
  size: number
  fps: number
}

export type ActivityPlaylistSegmentHashesObject = {
  type: 'Link'
  name: 'sha256'
  mediaType: 'application/json'
  href: string
}

export type ActivityVideoFileMetadataObject = {
  type: 'Link'
  rel: [ 'metadata', any ]
  mediaType: 'application/json'
  height: number
  href: string
  fps: number
}

export type ActivityPlaylistInfohashesObject = {
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
}

export type ActivityMagnetUrlObject = {
  type: 'Link'
  mediaType: 'application/x-bittorrent;x-scheme-handler/magnet'
  href: string
  height: number
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

export type ActivityTagObject =
  ActivityPlaylistSegmentHashesObject
  | ActivityPlaylistInfohashesObject
  | ActivityVideoUrlObject
  | ActivityHashTagObject
  | ActivityMentionObject
  | ActivityBitTorrentUrlObject
  | ActivityMagnetUrlObject
  | ActivityVideoFileMetadataObject

export type ActivityUrlObject =
  ActivityVideoUrlObject
  | ActivityPlaylistUrlObject
  | ActivityBitTorrentUrlObject
  | ActivityMagnetUrlObject
  | ActivityHtmlUrlObject
  | ActivityVideoFileMetadataObject

export interface ActivityPubAttributedTo {
  type: 'Group' | 'Person'
  id: string
}

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
