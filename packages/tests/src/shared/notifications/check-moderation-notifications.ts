/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { AbuseState, AbuseStateType, UserNotification, UserNotificationType } from '@peertube/peertube-models'
import { expect } from 'chai'
import { checkActor, CheckerBaseParams, CheckerType, checkNotification, checkVideo } from './shared/notification-checker.js'

export async function checkNewVideoAbuseForModerators (
  options: CheckerBaseParams & {
    shortUUID: string
    videoName: string
    checkType: CheckerType
  }
) {
  const { shortUUID, videoName } = options
  const notificationType = UserNotificationType.NEW_ABUSE_FOR_MODERATORS

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.abuse.id).to.be.a('number')
      checkVideo(notification.abuse.video, videoName, shortUUID)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.abuse?.video.shortUUID !== shortUUID
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(shortUUID) !== -1 && text.indexOf('abuse') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkNewAbuseMessage (
  options: CheckerBaseParams & {
    abuseId: number
    message: string
    toEmail: string
    checkType: CheckerType
  }
) {
  const { abuseId, message, toEmail } = options
  const notificationType = UserNotificationType.ABUSE_NEW_MESSAGE

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.abuse.id).to.equal(abuseId)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.type !== notificationType || n.abuse?.id !== abuseId
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    const to = email['to'].filter(t => t.address === toEmail)

    return text.indexOf(message) !== -1 && to.length !== 0
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkAbuseStateChange (
  options: CheckerBaseParams & {
    abuseId: number
    state: AbuseStateType
    checkType: CheckerType
  }
) {
  const { abuseId, state } = options
  const notificationType = UserNotificationType.ABUSE_STATE_CHANGE

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.abuse.id).to.equal(abuseId)
      expect(notification.abuse.state).to.equal(state)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.abuse?.id !== abuseId
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']

    const contains = state === AbuseState.ACCEPTED
      ? ' accepted'
      : ' rejected'

    return text.indexOf(contains) !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkNewCommentAbuseForModerators (
  options: CheckerBaseParams & {
    shortUUID: string
    videoName: string
    checkType: CheckerType
  }
) {
  const { shortUUID, videoName } = options
  const notificationType = UserNotificationType.NEW_ABUSE_FOR_MODERATORS

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.abuse.id).to.be.a('number')
      checkVideo(notification.abuse.comment.video, videoName, shortUUID)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.abuse?.comment.video.shortUUID !== shortUUID
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(shortUUID) !== -1 && text.indexOf('abuse') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkNewAccountAbuseForModerators (
  options: CheckerBaseParams & {
    displayName: string
    checkType: CheckerType
  }
) {
  const { displayName } = options
  const notificationType = UserNotificationType.NEW_ABUSE_FOR_MODERATORS

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.abuse.id).to.be.a('number')
      expect(notification.abuse.account.displayName).to.equal(displayName)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.abuse?.account.displayName !== displayName
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(displayName) !== -1 && text.indexOf('abuse') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkVideoAutoBlacklistForModerators (
  options: CheckerBaseParams & {
    shortUUID: string
    videoName: string
    checkType: CheckerType
  }
) {
  const { shortUUID, videoName } = options
  const notificationType = UserNotificationType.VIDEO_AUTO_BLACKLIST_FOR_MODERATORS

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.videoBlacklist.video.id).to.be.a('number')
      checkVideo(notification.videoBlacklist.video, videoName, shortUUID)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.video?.shortUUID !== shortUUID
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(shortUUID) !== -1 && email['text'].indexOf('moderation/video-blocks/list') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkAutomaticBlocklistForModerators (
  options: CheckerBaseParams & {
    expectedBlockedAccountsCount: number
    expectedBlockedHostsCount: number
    expectedUnblockedAccountsCount: number
    expectedUnblockedHostsCount: number
    checkType: CheckerType
  }
) {
  const {
    expectedBlockedAccountsCount,
    expectedBlockedHostsCount,
    expectedUnblockedAccountsCount,
    expectedUnblockedHostsCount
  } = options

  const notificationType = UserNotificationType.AUTOMATIC_BLOCKLIST_UPDATE

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.data.blockedAccountsCount).to.equal(expectedBlockedAccountsCount)
      expect(notification.data.blockedHostsCount).to.equal(expectedBlockedHostsCount)
      expect(notification.data.unblockedAccountsCount).to.equal(expectedUnblockedAccountsCount)
      expect(notification.data.unblockedHostsCount).to.equal(expectedUnblockedHostsCount)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        if (n?.type !== notificationType) return true
        if (!n?.data) return true

        const data = n.data

        return data.blockedAccountsCount !== expectedBlockedAccountsCount ||
          data.blockedHostsCount !== expectedBlockedHostsCount ||
          data.unblockedAccountsCount !== expectedUnblockedAccountsCount ||
          data.unblockedHostsCount !== expectedUnblockedHostsCount
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']

    return text.includes(`${expectedBlockedAccountsCount} account(s) and ${expectedBlockedHostsCount} server(s) were blocked`) &&
      text.includes(`${expectedUnblockedAccountsCount} account(s) and ${expectedUnblockedHostsCount} server(s) were unblocked`)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkNewBlacklistOnMyVideo (
  options: CheckerBaseParams & {
    shortUUID: string
    videoName: string
    blacklistType: 'blacklist' | 'unblacklist'
  }
) {
  const { videoName, shortUUID, blacklistType } = options
  const notificationType = blacklistType === 'blacklist'
    ? UserNotificationType.BLACKLIST_ON_MY_VIDEO
    : UserNotificationType.UNBLACKLIST_ON_MY_VIDEO

  function notificationChecker (notification: UserNotification) {
    expect(notification).to.not.be.undefined
    expect(notification.type).to.equal(notificationType)

    const video = blacklistType === 'blacklist' ? notification.videoBlacklist.video : notification.video

    checkVideo(video, videoName, shortUUID)
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']

    const blacklistReg = blacklistType === 'blacklist'
      ? /\bblocked\b/
      : /\bunblocked\b/

    return text.includes(shortUUID) && !!text.match(blacklistReg)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder, checkType: 'presence' })
}

export async function checkUserRegistered (
  options: CheckerBaseParams & {
    username: string
    checkType: CheckerType
  }
) {
  const { username } = options
  const notificationType = UserNotificationType.NEW_USER_REGISTRATION

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      checkActor(notification.account, { withAvatar: false })
      expect(notification.account.name).to.equal(username)
    } else {
      expect(notification).to.satisfy(n => n.type !== notificationType || n.account.name !== username)
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']

    return text.includes(' registered.') && text.includes(username)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkRegistrationRequest (
  options: CheckerBaseParams & {
    username: string
    registrationReason: string
    checkType: CheckerType
  }
) {
  const { username, registrationReason } = options
  const notificationType = UserNotificationType.NEW_USER_REGISTRATION_REQUEST

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.registration.username).to.equal(username)
    } else {
      expect(notification).to.satisfy(n => n.type !== notificationType || n.registration.username !== username)
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']

    return text.includes(' wants to register ') && text.includes(username) && text.includes(registrationReason)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}
