import { uniqify } from '@peertube/peertube-core-utils'
import {
  AutomaticTagAvailable,
  AutomaticTagPolicy,
  CommentAutomaticTagPolicies,
  CommentAutomaticTagsTrigger,
  VideoAutomaticTagsTrigger,
  VideoAutoTagPolicies
} from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { getServerAccount } from '@server/models/application/application.js'
import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'
import { CommentAutomaticTagModel } from '@server/models/automatic-tag/comment-automatic-tag.js'
import { VideoAutomaticTagModel } from '@server/models/automatic-tag/video-automatic-tag.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { MAccount, MAccountId, MComment, MVideo } from '@server/types/models/index.js'
import { LinkifyIt } from 'linkify-it'
import { PluginManager } from '../plugins/plugin-manager.js'

const logger = createLogger('automatic-tags')

const linkifyIt = new LinkifyIt({ fuzzyLink: true })

export class AutomaticTagger {
  private static readonly SPECIAL_TAGS = {
    EXTERNAL_LINK: 'external-link'
  }

  // Never run inside a transaction: plugin auto taggers can be slow
  async buildCommentsAutomaticTags (options: {
    serverAccount: MAccount | null
    ownerAccount: MAccount | null
    comment: Pick<MComment, 'id' | 'text'>
    trigger: CommentAutomaticTagsTrigger
  }) {
    const { comment, serverAccount, ownerAccount, trigger } = options
    const text = comment.text

    // accountId -> tags
    const result: Record<number, string[]> = {}

    try {
      // Plugin tags are assigned to all the accounts we build the tags for, so get the current ones of these accounts
      const currentCommentTags = await CommentAutomaticTagModel.listByAccountIdsAndCommentId({
        commentId: comment.id,
        accountIds: [ serverAccount, ownerAccount ].filter(a => !!a).map(a => a.id)
      })
      const currentTags = uniqify(currentCommentTags.map(t => t.AutomaticTag.name))

      const pluginAutoTags = await this.runAutoTaggers(
        PluginManager.Instance.getCommentAutoTaggers(),
        ({ handler, autoTagNames }) => {
          return handler({
            comment: { text },
            trigger,
            currentTags: currentTags.filter(t => autoTagNames.includes(t))
          })
        }
      )

      if (serverAccount) {
        const tags = [
          ...await this.buildAutomaticTags({ account: serverAccount, text }),
          ...pluginAutoTags
        ]

        result[serverAccount.id] = uniqify(tags)
      }

      if (ownerAccount) {
        const tags = [
          ...await this.buildAutomaticTags({ account: ownerAccount, text }),
          ...pluginAutoTags
        ]

        result[ownerAccount.id] = uniqify(tags)
      }

      logger.debug('Built automatic tags for comment', { text, result })

      return result
    } catch (err) {
      logger.error('Cannot build comment automatic tags', { text, err })

      return {}
    }
  }

  // See `buildCommentsAutomaticTags`: never run inside a transaction
  async buildVideoAutomaticTags (options: {
    serverAccount: MAccount
    video: Pick<MVideo, 'id' | 'name' | 'description'>
    trigger: VideoAutomaticTagsTrigger
  }) {
    const { video, serverAccount, trigger } = options

    try {
      // Let auto taggers that analyze the video files keep their previous tags when the files did not change
      const currentVideoTags = await VideoAutomaticTagModel.listByAccountIdsAndVideoId({
        videoId: video.id,
        accountIds: [ serverAccount.id ]
      })
      const currentTags = currentVideoTags.map(t => t.AutomaticTag.name)

      const [ videoNameTags, videoDescriptionTags, pluginTags ] = await Promise.all([
        this.buildAutomaticTags({ account: serverAccount, text: video.name }),
        this.buildAutomaticTags({ account: serverAccount, text: video.description }),
        this.runAutoTaggers(PluginManager.Instance.getVideoAutoTaggers(), ({ handler, autoTagNames }) => {
          return handler({
            video,
            trigger,
            currentTags: currentTags.filter(t => autoTagNames.includes(t))
          })
        })
      ])

      logger.debug('Built automatic tags for video', {
        videoName: video.name,
        videoDescription: video.description,
        trigger,
        videoNameTags,
        videoDescriptionTags,
        pluginTags
      })

      return { [serverAccount.id]: uniqify([ ...videoNameTags, ...videoDescriptionTags, ...pluginTags ]) }
    } catch (err) {
      logger.error('Cannot build video automatic tags', { video, err })

      return {}
    }
  }

  private async buildAutomaticTags (options: {
    account: MAccount
    text: string
  }) {
    const { text, account } = options

    const tagsDone = new Set<string>()
    const automaticTags: string[] = []

    // Watched words by account that published the video
    const watchedWords = await WatchedWordsListModel.buildWatchedWordsRegexp({ accountId: account.id })

    logger.debug(`Got watched words regex for account ${account.id}`, {
      listNames: watchedWords.map(r => r.listName)
    })

    for (const { listName, regex } of watchedWords) {
      try {
        if (regex.test(text)) {
          tagsDone.add(listName)
          automaticTags.push(listName)
        }
      } catch (err) {
        logger.error('Cannot test regex against text', { listName, regex: regex.toString(), err })
      }
    }

    // Core PeerTube tags
    if (!tagsDone.has(AutomaticTagger.SPECIAL_TAGS.EXTERNAL_LINK) && this.hasExternalLinks(text)) {
      // This is a global tag, not assigned to a specific account
      automaticTags.push(AutomaticTagger.SPECIAL_TAGS.EXTERNAL_LINK)
      tagsDone.add(AutomaticTagger.SPECIAL_TAGS.EXTERNAL_LINK)
    }

    logger.debug('Built automatic tags for text', { text, automaticTags })

    return automaticTags
  }

  // Auto taggers of plugins can be slow (they may call an external service), so run them in parallel
  private async runAutoTaggers<T extends { autoTagNames: string[] }> (
    plugins: { npmName: string, autoTaggers: T[] }[],
    run: (autoTagger: T) => Promise<{ tags: string[] }>
  ) {
    const tagsPerAutoTagger = await Promise.all(
      plugins.flatMap(({ npmName, autoTaggers }) => {
        return autoTaggers.map(async autoTagger => {
          try {
            const { tags } = await run(autoTagger)

            // A plugin can only assign the tags it registered
            return (tags || []).filter(t => autoTagger.autoTagNames.includes(t))
          } catch (err) {
            logger.error('Cannot execute auto tagger of plugin ' + npmName, { err })

            return []
          }
        })
      })
    )

    return tagsPerAutoTagger.flat()
  }

  private hasExternalLinks (text: string) {
    if (!text) return false

    const matches = linkifyIt.match(text)
    if (!matches) return false

    logger.debug('Found external links in text', { matches, text })

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

    return uniqify(toLoad.flatMap(({ autoTaggers }) => autoTaggers.flatMap(a => a.autoTagNames)))
      .map(name => ({ name, type: 'plugin' as const }))
  }
}
