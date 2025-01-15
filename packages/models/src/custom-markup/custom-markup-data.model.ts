type StringBoolean = 'true' | 'false'

export type EmbedMarkupData = {
  // Video or playlist uuid
  uuid: string
}

export type VideoMiniatureMarkupData = {
  // Video uuid
  uuid: string

  onlyDisplayTitle?: StringBoolean
}

export type PlaylistMiniatureMarkupData = {
  // Playlist uuid
  uuid: string
}

export type ChannelMiniatureMarkupData = {
  // Channel name (username)
  name: string

  displayLatestVideo?: StringBoolean
  displayDescription?: StringBoolean
}

export type VideosListMarkupData = {
  onlyDisplayTitle?: StringBoolean
  maxRows?: string // number

  sort?: string
  count?: string // number

  categoryOneOf?: string // coma separated values, number[]
  languageOneOf?: string // coma separated values

  channelHandle?: string
  accountHandle?: string

  isLive?: string // number

  onlyLocal?: StringBoolean
}

export type ButtonMarkupData = {
  theme: 'primary' | 'secondary'
  href: string
  label: string
  blankTarget?: StringBoolean
}

export type ContainerMarkupData = {
  width?: string
  title?: string
  description?: string
  layout?: 'row' | 'column'

  justifyContent?: 'space-between' | 'normal' // default to 'space-between'
}

export type InstanceAvatarMarkupData = {
  size: string // size in pixels
}
