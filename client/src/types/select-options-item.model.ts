export interface SelectOptionsItem {
  id: string | number
  label: string

  description?: string
  imageUrl?: string
  classes?: string[]
}

export interface SelectChannelItem extends SelectOptionsItem {
  id: number // Force number
  avatarPath?: string
  support?: string
}
