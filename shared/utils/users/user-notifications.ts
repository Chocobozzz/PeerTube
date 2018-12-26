/* tslint:disable:no-unused-expression */

import { makeGetRequest, makePostBodyRequest, makePutBodyRequest } from '../requests/requests'
import { UserNotification, UserNotificationSetting, UserNotificationType } from '../../models/users'
import { ServerInfo } from '..'
import { expect } from 'chai'

function updateMyNotificationSettings (url: string, token: string, settings: UserNotificationSetting, statusCodeExpected = 204) {
  const path = '/api/v1/users/me/notification-settings'

  return makePutBodyRequest({
    url,
    path,
    token,
    fields: settings,
    statusCodeExpected
  })
}

function getUserNotifications (url: string, token: string, start: number, count: number, sort = '-createdAt', statusCodeExpected = 200) {
  const path = '/api/v1/users/me/notifications'

  return makeGetRequest({
    url,
    path,
    token,
    query: {
      start,
      count,
      sort
    },
    statusCodeExpected
  })
}

function markAsReadNotifications (url: string, token: string, ids: number[], statusCodeExpected = 204) {
  const path = '/api/v1/users/me/notifications/read'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: { ids },
    statusCodeExpected
  })
}

async function getLastNotification (serverUrl: string, accessToken: string) {
  const res = await getUserNotifications(serverUrl, accessToken, 0, 1, '-createdAt')

  if (res.body.total === 0) return undefined

  return res.body.data[0] as UserNotification
}

type CheckerBaseParams = {
  server: ServerInfo
  emails: object[]
  socketNotifications: UserNotification[]
  token: string,
  check?: { web: boolean, mail: boolean }
}

type CheckerType = 'presence' | 'absence'

async function checkNotification (
  base: CheckerBaseParams,
  lastNotificationChecker: (notification: UserNotification) => void,
  socketNotificationFinder: (notification: UserNotification) => boolean,
  emailNotificationFinder: (email: object) => boolean,
  checkType: 'presence' | 'absence'
) {
  const check = base.check || { web: true, mail: true }

  if (check.web) {
    const notification = await getLastNotification(base.server.url, base.token)
    lastNotificationChecker(notification)

    const socketNotification = base.socketNotifications.find(n => socketNotificationFinder(n))

    if (checkType === 'presence') expect(socketNotification, 'The socket notification is absent.').to.not.be.undefined
    else expect(socketNotification, 'The socket notification is present.').to.be.undefined
  }

  if (check.mail) {
    // Last email
    const email = base.emails
                      .slice()
                      .reverse()
                      .find(e => emailNotificationFinder(e))

    if (checkType === 'presence') expect(email, 'The email is present.').to.not.be.undefined
    else expect(email, 'The email is absent.').to.be.undefined
  }
}

async function checkNewVideoFromSubscription (base: CheckerBaseParams, videoName: string, videoUUID: string, type: CheckerType) {
  const notificationType = UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION

  function lastNotificationChecker (notification: UserNotification) {
    if (type === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)
      expect(notification.video.name).to.equal(videoName)
    } else {
      expect(notification.video).to.satisfy(v => v === undefined || v.name !== videoName)
    }
  }

  function socketFinder (notification: UserNotification) {
    return notification.type === notificationType && notification.video.name === videoName
  }

  function emailFinder (email: object) {
    return email[ 'text' ].indexOf(videoUUID) !== -1
  }

  await checkNotification(base, lastNotificationChecker, socketFinder, emailFinder, type)
}

let lastEmailCount = 0
async function checkNewCommentOnMyVideo (base: CheckerBaseParams, uuid: string, commentId: number, threadId: number, type: CheckerType) {
  const notificationType = UserNotificationType.NEW_COMMENT_ON_MY_VIDEO

  function lastNotificationChecker (notification: UserNotification) {
    if (type === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)
      expect(notification.comment.id).to.equal(commentId)
      expect(notification.comment.account.displayName).to.equal('root')
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n === undefined || n.comment === undefined || n.comment.id !== commentId
      })
    }
  }

  function socketFinder (notification: UserNotification) {
    return notification.type === notificationType &&
      notification.comment.id === commentId &&
      notification.comment.account.displayName === 'root'
  }

  const commentUrl = `http://localhost:9001/videos/watch/${uuid};threadId=${threadId}`
  function emailFinder (email: object) {
    return email[ 'text' ].indexOf(commentUrl) !== -1
  }

  await checkNotification(base, lastNotificationChecker, socketFinder, emailFinder, type)

  if (type === 'presence') {
    // We cannot detect email duplicates, so check we received another email
    expect(base.emails).to.have.length.above(lastEmailCount)
    lastEmailCount = base.emails.length
  }
}

async function checkNewVideoAbuseForModerators (base: CheckerBaseParams, videoUUID: string, videoName: string, type: CheckerType) {
  const notificationType = UserNotificationType.NEW_VIDEO_ABUSE_FOR_MODERATORS

  function lastNotificationChecker (notification: UserNotification) {
    if (type === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)
      expect(notification.videoAbuse.video.uuid).to.equal(videoUUID)
      expect(notification.videoAbuse.video.name).to.equal(videoName)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n === undefined || n.videoAbuse === undefined || n.videoAbuse.video.uuid !== videoUUID
      })
    }
  }

  function socketFinder (notification: UserNotification) {
    return notification.type === notificationType && notification.videoAbuse.video.uuid === videoUUID
  }

  function emailFinder (email: object) {
    const text = email[ 'text' ]
    return text.indexOf(videoUUID) !== -1 && text.indexOf('abuse') !== -1
  }

  await checkNotification(base, lastNotificationChecker, socketFinder, emailFinder, type)
}

async function checkNewBlacklistOnMyVideo (
  base: CheckerBaseParams,
  videoUUID: string,
  videoName: string,
  blacklistType: 'blacklist' | 'unblacklist'
) {
  const notificationType = blacklistType === 'blacklist'
    ? UserNotificationType.BLACKLIST_ON_MY_VIDEO
    : UserNotificationType.UNBLACKLIST_ON_MY_VIDEO

  function lastNotificationChecker (notification: UserNotification) {
    expect(notification).to.not.be.undefined
    expect(notification.type).to.equal(notificationType)

    const video = blacklistType === 'blacklist' ? notification.videoBlacklist.video : notification.video

    expect(video.uuid).to.equal(videoUUID)
    expect(video.name).to.equal(videoName)
  }

  function socketFinder (notification: UserNotification) {
    return notification.type === notificationType && (notification.video || notification.videoBlacklist.video).uuid === videoUUID
  }

  function emailFinder (email: object) {
    const text = email[ 'text' ]
    return text.indexOf(videoUUID) !== -1 && text.indexOf(' ' + blacklistType) !== -1
  }

  await checkNotification(base, lastNotificationChecker, socketFinder, emailFinder, 'presence')
}

// ---------------------------------------------------------------------------

export {
  CheckerBaseParams,
  CheckerType,
  checkNotification,
  checkNewVideoFromSubscription,
  checkNewCommentOnMyVideo,
  checkNewBlacklistOnMyVideo,
  updateMyNotificationSettings,
  checkNewVideoAbuseForModerators,
  getUserNotifications,
  markAsReadNotifications,
  getLastNotification
}
