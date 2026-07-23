export type AutoMuteActionType = 'block' | 'unblock'

export interface AutoMuteAction {
  type: AutoMuteActionType
  target: string
  createdAt: string
}

export interface AutoMuteList {
  name: string
  actions: AutoMuteAction[]
}
