type StringBoolean = 'true' | 'false'

export type EmbedMarkupData = {
  // Video or playlist uuid
  uuid: string
  responsive?: StringBoolean
  startAt?: string
  stopAt?: string
  subtitle?: string
  autoplay?: StringBoolean
  muted?: StringBoolean
  loop?: StringBoolean
  title?: StringBoolean
  p2p?: StringBoolean
  warningTitle?: StringBoolean
  controlBar?: StringBoolean
  peertubeLink?: StringBoolean
  playlistPosition?: string // number
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

  sort?: string
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
  playlistId?: string

  host?: string

  isLive?: string // number

  onlyLocal?: StringBoolean

  moreHref?: string
  morePath?: string // Client route
  moreLabel?: string
}

export type ButtonMarkupData = {
  theme: 'primary' | 'secondary'
  href?: string
  path?: string // Client route
  label: string
  blankTarget?: StringBoolean
  icon?: string // GlobalIconName of the client
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

export type HeroMarkupData = {
  title?: string
  description?: string
}

export type CardMarkupData = {
  title?: string
  description?: string
  bordered?: StringBoolean
}
