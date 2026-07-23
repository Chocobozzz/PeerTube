export type WatchedWordsSubscriptionActionType = 'add' | 'remove'

export interface WatchedWordsSubscriptionAction {
  type: WatchedWordsSubscriptionActionType
  word: string
  createdAt: string
}

export interface WatchedWordsSubscriptionActions {
  name: string
  actions: WatchedWordsSubscriptionAction[]
}
