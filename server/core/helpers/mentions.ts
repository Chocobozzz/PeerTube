import { uniqify } from '@peertube/peertube-core-utils'
import { WEBSERVER } from '@server/initializers/constants.js'
import { actorNameAlphabet } from './custom-validators/activitypub/actor.js'
import { regexpCapture } from './regexp.js'

export function extractMentions (text: string, isOwned: boolean) {
  let result: string[] = []

  const localMention = `@(${actorNameAlphabet}+)`
  const remoteMention = `${localMention}@${WEBSERVER.HOST}`

  const mentionRegex = isOwned
    ? '(?:(?:' + remoteMention + ')|(?:' + localMention + '))' // Include local mentions?
    : '(?:' + remoteMention + ')'

  const firstMentionRegex = new RegExp(`^${mentionRegex} `, 'g')
  const endMentionRegex = new RegExp(` ${mentionRegex}$`, 'g')
  const remoteMentionsRegex = new RegExp(' ' + remoteMention + ' ', 'g')

  result = result.concat(
    regexpCapture(text, firstMentionRegex)
      .map(([ , username1, username2 ]) => username1 || username2),

    regexpCapture(text, endMentionRegex)
      .map(([ , username1, username2 ]) => username1 || username2),

    regexpCapture(text, remoteMentionsRegex)
      .map(([ , username ]) => username)
  )

  // Include local mentions
  if (isOwned) {
    const localMentionsRegex = new RegExp(' ' + localMention + ' ', 'g')

    result = result.concat(
      regexpCapture(text, localMentionsRegex)
        .map(([ , username ]) => username)
    )
  }

  return uniqify(result)
}
