import { uniqify } from '@peertube/peertube-core-utils'
import { WEBSERVER } from '@server/initializers/constants.js'
import { actorNameAlphabet } from './custom-validators/activitypub/actor.js'
import { regexpCapture } from './regexp.js'

export function extractLocalMentions (text: string, fromLocalEntity: boolean) {
  const setHostOptionalChar = fromLocalEntity
    ? '?'
    : ''

  // FIXME: Use RegExp.escape() when NodeJS 24 is the minimum version required by peertube
  const mentionRegex = new RegExp(`(?<=^|\\s)@(${actorNameAlphabet}+)(?:@${WEBSERVER.HOST})${setHostOptionalChar}(?=[\\s.,!?)]|$)`, 'gmu')

  const results = regexpCapture(text, mentionRegex)
    .map(([ , username ]) => username)

  return uniqify(results)
}
