export interface SelectOptionsItem<T = string | number> {
  id: T
  label: string

  description?: string
  imageUrl?: string
  classes?: string[]
}

export interface SelectChannelItem extends SelectOptionsItem {
  id: number // Force number
  name: string
  avatarPath: string
  support: string
}
