export interface ActivityIdentifierObject {
  identifier: string
  name: string
}
export interface ActivityTagObject {
  type: 'Hashtag' | 'Mention'
  href?: string
  name: string
}
export interface ActivityAutorObject {
  type: 'Hashautor' | 'Mention'
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

export type ActivityUrlObject =
  ActivityVideoUrlObject
  |
  {
    type: 'Link'
    // TODO: remove mimeType (backward compatibility, introduced in v1.1.0)
    mimeType?: 'application/x-bittorrent' | 'application/x-bittorrent;x-scheme-handler/magnet'
    mediaType: 'application/x-bittorrent' | 'application/x-bittorrent;x-scheme-handler/magnet'
    href: string
    height: number
  }
  |
  {
    type: 'Link'
    // TODO: remove mimeType (backward compatibility, introduced in v1.1.0)
    mimeType?: 'text/html'
    mediaType: 'text/html'
    href: string
  }

export interface ActivityPubAttributedTo {
  type: 'Group' | 'Person'
  id: string
}
