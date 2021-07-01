export type EmbedMarkupData = {
  // Video or playlist uuid
  uuid: string
}

export type VideoMiniatureMarkupData = {
  // Video uuid
  uuid: string

  onlyDisplayTitle?: string // boolean
}

export type PlaylistMiniatureMarkupData = {
  // Playlist uuid
  uuid: string
}

export type ChannelMiniatureMarkupData = {
  // Channel name (username)
  name: string

  displayLatestVideo?: string // boolean
  displayDescription?: string // boolean
}

export type VideosListMarkupData = {
  onlyDisplayTitle?: string // boolean
  maxRows?: string // number

  sort?: string
  count?: string // number

  categoryOneOf?: string // coma separated values, number[]
  languageOneOf?: string // coma separated values

  channelHandle?: string
  accountHandle?: string

  onlyLocal?: string // boolean
}

export type ButtonMarkupData = {
  theme: 'primary' | 'secondary'
  href: string
  label: string
  blankTarget?: string // boolean
}

export type ContainerMarkupData = {
  width?: string
  title?: string
  description?: string
  layout?: 'row' | 'column'
}
