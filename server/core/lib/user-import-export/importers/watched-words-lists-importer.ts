import { pick } from '@peertube/peertube-core-utils'
import { WatchedWordsListsJSON } from '@peertube/peertube-models'
import { areWatchedWordsValid, isWatchedWordListNameValid } from '@server/helpers/custom-validators/watched-words.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { AbstractUserImporter } from './abstract-user-importer.js'

type SanitizedObject = Pick<WatchedWordsListsJSON['watchedWordLists'][0], 'listName' | 'words'>

// eslint-disable-next-line max-len
export class WatchedWordsListsImporter extends AbstractUserImporter <WatchedWordsListsJSON, WatchedWordsListsJSON['watchedWordLists'][0], SanitizedObject> {

  protected getImportObjects (json: WatchedWordsListsJSON) {
    return json.watchedWordLists
  }

  protected sanitize (data: WatchedWordsListsJSON['watchedWordLists'][0]) {
    if (!isWatchedWordListNameValid(data.listName)) return undefined
    if (!areWatchedWordsValid(data.words)) return undefined

    return pick(data, [ 'listName', 'words' ])
  }

  protected async importObject (data: SanitizedObject) {
    const accountId = this.user.Account.id
    const existing = await WatchedWordsListModel.loadByListName({ listName: data.listName, accountId })

    if (existing) {
      await existing.updateList({ listName: data.listName, words: data.words })
    } else {
      await WatchedWordsListModel.createList({ accountId, listName: data.listName, words: data.words })
    }

    return { duplicate: false }
  }
}
