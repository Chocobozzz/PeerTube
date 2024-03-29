import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'

export type MWatchedWordsList = Omit<WatchedWordsListModel, 'Account'>
