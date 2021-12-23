export interface SelectOptionsItem {
  id: string | number
  label: string
  description?: string
  group?: string
  groupLabel?: string
}

export interface SelectChannelItem extends SelectOptionsItem {
  id: number
  support: string
  avatarPath?: string
}
