export interface WatchedWordsListsJSON {
  watchedWordLists: {
    createdAt: string
    updatedAt: string
    listName: string
    words: string[]

    archiveFiles?: never
  }[]
}
