export interface WatchedWordsList {
  id: number

  listName: string
  words: string[]
  subscriptionUrl: string | null

  updatedAt: Date | string
  createdAt: Date | string
}
