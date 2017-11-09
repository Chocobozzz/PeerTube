export interface ActivityIdentifierObject {
  identifier: string
  name: string
}

export interface ActivityTagObject {
  type: 'Hashtag'
  name: string
}

export interface ActivityIconObject {
  type: 'Image'
  url: string
  mediaType: 'image/jpeg'
  width: number
  height: number
}

export interface ActivityUrlObject {
  type: 'Link'
  mimeType: 'video/mp4' | 'video/webm' | 'application/x-bittorrent' | 'application/x-bittorrent;x-scheme-handler/magnet'
  url: string
  width: number
  size?: number
}
