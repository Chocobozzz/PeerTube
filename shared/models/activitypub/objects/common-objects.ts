export interface ActivityIdentifierObject {
  identifier: string
  name: string
}

export interface ActivityTagObject {
  type: 'Hashtag' | 'Mention'
  href?: string
  name: string
}

export interface ActivityIconObject {
  type: 'Image'
  url: string
  mediaType: 'image/jpeg'
  width: number
  height: number
}

export type ActivityVideoUrlObject = {
  type: 'Link'
  // TODO: remove mimeType (backward compatibility, introduced in v1.1.0)
  mimeType?: 'video/mp4' | 'video/webm' | 'video/ogg'
  mediaType: 'video/mp4' | 'video/webm' | 'video/ogg'
  href: string
  height: number
  size: number
  fps: number
}

export type ActivityPlaylistSegmentHashesObject = {
  type: 'Link'
  name: 'sha256'
  // TODO: remove mimeType (backward compatibility, introduced in v1.1.0)
  mimeType?: 'application/json'
  mediaType: 'application/json'
  href: string
}

export type ActivityPlaylistInfohashesObject = {
  type: 'Infohash'
  name: string
}

export type ActivityPlaylistUrlObject = {
  type: 'Link'
  // TODO: remove mimeType (backward compatibility, introduced in v1.1.0)
  mimeType?: 'application/x-mpegURL'
  mediaType: 'application/x-mpegURL'
  href: string
  tag?: (ActivityPlaylistSegmentHashesObject | ActivityPlaylistInfohashesObject)[]
}

export type ActivityBitTorrentUrlObject = {
  type: 'Link'
  // TODO: remove mimeType (backward compatibility, introduced in v1.1.0)
  mimeType?: 'application/x-bittorrent' | 'application/x-bittorrent;x-scheme-handler/magnet'
  mediaType: 'application/x-bittorrent' | 'application/x-bittorrent;x-scheme-handler/magnet'
  href: string
  height: number
}

export type ActivityHtmlUrlObject = {
  type: 'Link'
  // TODO: remove mimeType (backward compatibility, introduced in v1.1.0)
  mimeType?: 'text/html'
  mediaType: 'text/html'
  href: string
}

export type ActivityUrlObject = ActivityVideoUrlObject | ActivityPlaylistUrlObject | ActivityBitTorrentUrlObject | ActivityHtmlUrlObject

export interface ActivityPubAttributedTo {
  type: 'Group' | 'Person'
  id: string
}
