export type EmbedMarkupData = {
  // Video or playlist uuid
  uuid: string
}

export type VideoMiniatureMarkupData = {
  // Video uuid
  uuid: string
}

export type PlaylistMiniatureMarkupData = {
  // Playlist uuid
  uuid: string
}

export type ChannelMiniatureMarkupData = {
  // Channel name (username)
  name: string
}

export type VideosListMarkupData = {
  sort: string
  categoryOneOf: string // coma separated values
  languageOneOf: string // coma separated values
  count: string
}

export type ButtonMarkupData = {
  theme: 'primary' | 'secondary'
  href: string
  label: string
  blankTarget?: string
}

export type ContainerMarkupData = {
  width?: string
  title?: string
  description?: string
}
