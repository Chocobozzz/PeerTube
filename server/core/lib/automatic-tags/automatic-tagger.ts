import { uniqify } from '@peertube/peertube-core-utils'
import { AutomaticTagAvailable, AutomaticTagPolicy, CommentAutomaticTagPolicies, VideoAutoTagPolicies } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { getServerAccount } from '@server/models/application/application.js'
import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { MAccount, MAccountId, MComment, MVideo } from '@server/types/models/index.js'
import Linkifyit from 'linkify-it'
import { Transaction } from 'sequelize'
import { PluginManager } from '../plugins/plugin-manager.js'

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
      const pluginAutoTags = await this.buildPluginAutomaticTags({ video: null, comment: { text } })

      if (serverAccount) {
        const tags = [
          ...await this.buildAutomaticTags({ account: serverAccount, text, transaction }),
          ...pluginAutoTags
        ]

        result[serverAccount.id] = uniqify(tags)
      }

      if (ownerAccount) {
        const tags = [
          ...await this.buildAutomaticTags({ account: ownerAccount, text, transaction }),
          ...pluginAutoTags
        ]

        result[ownerAccount.id] = uniqify(tags)
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
    video: Pick<MVideo, 'name' | 'description'>
    transaction?: Transaction
  }) {
    const { video, serverAccount, transaction } = options

    try {
      const [ videoNameTags, videoDescriptionTags, pluginTags ] = await Promise.all([
        this.buildAutomaticTags({ account: serverAccount, text: video.name, transaction }),
        this.buildAutomaticTags({ account: serverAccount, text: video.description, transaction }),
        this.buildPluginAutomaticTags({ video, comment: null })
      ])

      logger.debug('Built automatic tags for video', {
        videoName: video.name,
        videoDescription: video.description,
        videoNameTags,
        videoDescriptionTags,
        pluginTags,
        ...lTags()
      })

      return { [serverAccount.id]: uniqify([ ...videoNameTags, ...videoDescriptionTags, ...pluginTags ]) }
    } catch (err) {
      logger.error('Cannot build video automatic tags', { video, err, ...lTags() })

      return {}
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

  private async buildPluginAutomaticTags (options: {
    video: Pick<MVideo, 'name' | 'description'> | null
    comment: Pick<MComment, 'text'> | null
  }) {
    const { video, comment } = options

    const pluginTags: string[] = []

    const pluginWithAutoTags = video
      ? PluginManager.Instance.getVideoAutoTaggers()
      : PluginManager.Instance.getCommentAutoTaggers()

    for (const { npmName, autoTaggersPerTagName } of pluginWithAutoTags) {
      for (const autoTagName of Object.keys(autoTaggersPerTagName)) {
        for (const autoTagger of (autoTaggersPerTagName[autoTagName] || [])) {
          try {
            const { result } = await autoTagger({ video, comment })

            if (result) pluginTags.push(autoTagName)
          } catch (err) {
            logger.error('Cannot execute auto tagger of plugin ' + npmName, { err, ...lTags() })
          }
        }
      }
    }

    return pluginTags
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

  static async getVideoAutomaticTagPolicies (account: MAccountId) {
    const policies = await AccountAutomaticTagPolicyModel.listOfAccount(account)

    const result: VideoAutoTagPolicies = {
      autoBlock: policies.filter(p => p.policy === AutomaticTagPolicy.AUTO_BLACKLIST_VIDEO).map(p => p.name)
    }

    return result
  }

  static async getAutomaticTagAvailable (account: MAccountId) {
    const result: AutomaticTagAvailable = {
      available: [
        ...(await WatchedWordsListModel.listNamesOf(account)).map(t => ({ name: t, type: 'watched-words-list' as const })),

        ...Object.values(AutomaticTagger.SPECIAL_TAGS).map(t => ({ name: t, type: 'core' as const })),

        ...await this.getAvailablePluginAutomaticTagNames(account)
      ]
    }

    return result
  }

  private static async getAvailablePluginAutomaticTagNames (account: MAccountId) {
    const serverAccountId = (await getServerAccount()).id

    // The instance can only blacklist videos, it doesn't act on comments
    const toLoad = serverAccountId === account.id
      ? PluginManager.Instance.getVideoAutoTaggers()
      : PluginManager.Instance.getCommentAutoTaggers()

    return toLoad
      .flatMap(({ autoTaggersPerTagName }) => {
        // Keys that have at least one active auto tagger function
        return Object.keys(autoTaggersPerTagName)
          .filter(k => (autoTaggersPerTagName[k] || []).length > 0)
      })
      .map(name => ({ name, type: 'plugin' as const }))
  }
}
