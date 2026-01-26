/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotification, UserNotificationType } from '@peertube/peertube-models'
import { expect } from 'chai'
import { checkActor, checkComment, CheckerBaseParams, CheckerType, checkNotification, checkVideo } from './shared/notification-checker.js'

export async function checkCommentMention (
  options: CheckerBaseParams & {
    shortUUID: string
    commentId: number
    threadId: number
    byAccountDisplayName: string
    checkType: CheckerType
  }
) {
  const { shortUUID, commentId, threadId, byAccountDisplayName } = options
  const notificationType = UserNotificationType.COMMENT_MENTION

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      checkComment(notification.comment, commentId, threadId)
      checkActor(notification.comment.account)
      expect(notification.comment.account.displayName).to.equal(byAccountDisplayName)

      checkVideo(notification.comment.video, undefined, shortUUID)
    } else {
      expect(notification).to.satisfy(n => n.type !== notificationType || n.comment.id !== commentId)
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']

    return text.match(/\bmentioned\b/) && text.includes(shortUUID) && text.includes(byAccountDisplayName)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

let lastEmailCount = 0

export async function checkNewCommentOnMyVideo (
  options: CheckerBaseParams & {
    shortUUID: string
    commentId: number
    threadId: number
    checkType: CheckerType
    approval?: boolean // default false
  }
) {
  const { server, shortUUID, commentId, threadId, checkType, emails, approval = false } = options
  const notificationType = UserNotificationType.NEW_COMMENT_ON_MY_VIDEO

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      checkComment(notification.comment, commentId, threadId)
      checkActor(notification.comment.account)
      checkVideo(notification.comment.video, undefined, shortUUID)

      expect(notification.comment.heldForReview).to.equal(approval)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.comment?.id !== commentId
      })
    }
  }

  const commentUrl = approval
    ? `${server.url}/my-account/videos/comments?search=heldForReview:true`
    : `${server.url}/w/${shortUUID};threadId=${threadId}`

  function emailNotificationFinder (email: object) {
    const text = email['text']

    return text.includes(commentUrl) &&
        (approval && text.includes('requires approval')) ||
      (!approval && !text.includes('requires approval'))
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })

  if (checkType === 'presence') {
    // We cannot detect email duplicates, so check we received another email
    expect(emails).to.have.length.above(lastEmailCount)
    lastEmailCount = emails.length
  }
}
