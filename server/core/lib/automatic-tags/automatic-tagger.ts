import { AutomaticTagAvailable, AutomaticTagPolicy, CommentAutomaticTagPolicies } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { MAccount, MAccountId, MVideo } from '@server/types/models/index.js'
import Linkifyit from 'linkify-it'
import { Transaction } from 'sequelize'

const lTags = loggerTagsFactory('automatic-tags')

const linkifyit = new Linkifyit()

export class AutomaticTagger {
  private static readonly SPECIAL_TAGS = {
    EXTERNAL_LINK: 'external-link'
  }

  async buildCommentsAutomaticTags (options: {
    serverAccount: MAccount | null
    ownerAccount: MAccount | null
    text: string
    transaction?: Transaction
  }) {
    const { text, serverAccount, ownerAccount, transaction } = options

    // accountId -> tags
    const result: Record<number, string[]> = {}

    try {
      if (serverAccount) {
        result[serverAccount.id] = await this.buildAutomaticTags({ account: serverAccount, text, transaction })
      }

      if (ownerAccount) {
        result[ownerAccount.id] = await this.buildAutomaticTags({ account: ownerAccount, text, transaction })
      }

      logger.debug('Built automatic tags for comment', { text, result, ...lTags() })

      return result
    } catch (err) {
      logger.error('Cannot build comment automatic tags', { text, err, ...lTags() })

      return {}
    }
  }

  async buildVideoAutomaticTags (options: {
    serverAccount: MAccount
    video: MVideo
    transaction?: Transaction
  }) {
    const { video, serverAccount, transaction } = options

    try {
      const [ videoNameTags, videoDescriptionTags ] = await Promise.all([
        this.buildAutomaticTags({ account: serverAccount, text: video.name, transaction }),
        this.buildAutomaticTags({ account: serverAccount, text: video.description, transaction })
      ])

      logger.debug('Built automatic tags for video', {
        videoName: video.name,
        videoDescription: video.description,
        videoNameTags,
        videoDescriptionTags,
        ...lTags()
      })

      return { [serverAccount.id]: [ ...videoNameTags, ...videoDescriptionTags ] }
    } catch (err) {
      logger.error('Cannot build video automatic tags', { video, err, ...lTags() })

      return []
    }
  }

  private async buildAutomaticTags (options: {
    account: MAccount
    text: string
    transaction?: Transaction
  }) {
    const { text, account, transaction } = options

    const tagsDone = new Set<string>()
    const automaticTags: string[] = []

    // Watched words by account that published the video
    const watchedWords = await WatchedWordsListModel.buildWatchedWordsRegexp({ accountId: account.id, transaction })

    logger.debug(`Got watched words regex for account ${account.id}`, {
      listNames: watchedWords.map(r => r.listName),
      ...lTags()
    })

    for (const { listName, regex } of watchedWords) {
      try {
        if (regex.test(text)) {
          tagsDone.add(listName)
          automaticTags.push(listName)
        }
      } catch (err) {
        logger.error('Cannot test regex against text', { listName, regex: regex.toString(), err, ...lTags() })
      }
    }

    // Core PeerTube tags
    if (!tagsDone.has(AutomaticTagger.SPECIAL_TAGS.EXTERNAL_LINK) && this.hasExternalLinks(text)) {
      // This is a global tag, not assigned to a specific account
      automaticTags.push(AutomaticTagger.SPECIAL_TAGS.EXTERNAL_LINK)
      tagsDone.add(AutomaticTagger.SPECIAL_TAGS.EXTERNAL_LINK)
    }

    logger.debug('Built automatic tags for text', { text, automaticTags, ...lTags() })

    return automaticTags
  }

  private hasExternalLinks (text: string) {
    if (!text) return false

    const matches = linkifyit.match(text)
    if (!matches) return false

    logger.debug('Found external links in text', { matches, text, ...lTags() })

    return matches.some(({ url }) => new URL(url).host !== WEBSERVER.HOST)
  }

  // ---------------------------------------------------------------------------

  static async getAutomaticTagPolicies (account: MAccountId) {
    const policies = await AccountAutomaticTagPolicyModel.listOfAccount(account)

    const result: CommentAutomaticTagPolicies = {
      review: policies.filter(p => p.policy === AutomaticTagPolicy.REVIEW_COMMENT).map(p => p.name)
    }

    return result
  }

  static async getAutomaticTagAvailable (account: MAccountId) {
    const result: AutomaticTagAvailable = {
      available: [
        ...(await WatchedWordsListModel.listNamesOf(account)).map(t => ({ name: t, type: 'watched-words-list' as 'watched-words-list' })),

        ...Object.values(AutomaticTagger.SPECIAL_TAGS).map(t => ({ name: t, type: 'core' as 'core' }))
      ]
    }

    return result
  }
}
