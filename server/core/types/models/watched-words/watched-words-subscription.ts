import { WatchedWordsSubscriptionModel } from '@server/models/watched-words/watched-words-subscription.js'

export type MWatchedWordsSubscription = Omit<WatchedWordsSubscriptionModel, 'Account' | 'WatchedWordsLists'>
