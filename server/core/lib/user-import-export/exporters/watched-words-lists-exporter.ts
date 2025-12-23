import { WatchedWordsListsJSON } from '@peertube/peertube-models'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { AbstractUserExporter } from './abstract-user-exporter.js'

export class WatchedWordsListsExporter extends AbstractUserExporter <WatchedWordsListsJSON> {

  async export () {
    const data = await WatchedWordsListModel.listForExport({ accountId: this.user.Account.id })

    return {
      json: {
        watchedWordLists: data.map(list => ({
          listName: list.listName,
          words: list.words,
          createdAt: list.createdAt.toISOString(),
          updatedAt: list.updatedAt.toISOString()
        }))
      } as WatchedWordsListsJSON,

      staticFiles: []
    }
  }
}
