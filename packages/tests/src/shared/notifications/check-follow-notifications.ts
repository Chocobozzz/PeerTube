/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotification, UserNotificationType } from '@peertube/peertube-models'
import { expect } from 'chai'
import { checkActor, CheckerBaseParams, CheckerType, checkNotification } from './shared/notification-checker.js'

export async function checkNewActorFollow (
  options: CheckerBaseParams & {
    followType: 'channel' | 'account'
    followerName: string
    followerDisplayName: string
    followingDisplayName: string
    checkType: CheckerType
  }
) {
  const { followType, followerName, followerDisplayName, followingDisplayName } = options
  const notificationType = UserNotificationType.NEW_FOLLOW

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      checkActor(notification.actorFollow.follower)
      expect(notification.actorFollow.follower.displayName).to.equal(followerDisplayName)
      expect(notification.actorFollow.follower.name).to.equal(followerName)
      expect(notification.actorFollow.follower.host).to.not.be.undefined

      const following = notification.actorFollow.following
      expect(following.displayName).to.equal(followingDisplayName)
      expect(following.type).to.equal(followType)
    } else {
      expect(notification).to.satisfy(n => {
        return n.type !== notificationType ||
          (n.actorFollow.follower.name !== followerName && n.actorFollow.following !== followingDisplayName)
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']

    return text.includes(followType) && text.includes(followingDisplayName) && text.includes(followerDisplayName)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkNewInstanceFollower (
  options: CheckerBaseParams & {
    followerHost: string
    checkType: CheckerType
  }
) {
  const { followerHost } = options
  const notificationType = UserNotificationType.NEW_INSTANCE_FOLLOWER

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      checkActor(notification.actorFollow.follower, { withAvatar: false })
      expect(notification.actorFollow.follower.name).to.equal('peertube')
      expect(notification.actorFollow.follower.host).to.equal(followerHost)

      expect(notification.actorFollow.following.name).to.equal('peertube')
    } else {
      expect(notification).to.satisfy(n => {
        return n.type !== notificationType || n.actorFollow.follower.host !== followerHost
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']

    return text.includes('PeerTube has a new follower') && text.includes(followerHost)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkAutoInstanceFollowing (
  options: CheckerBaseParams & {
    followerHost: string
    followingHost: string
    checkType: CheckerType
  }
) {
  const { followerHost, followingHost } = options
  const notificationType = UserNotificationType.AUTO_INSTANCE_FOLLOWING

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      const following = notification.actorFollow.following

      checkActor(following, { withAvatar: false })
      expect(following.name).to.equal('peertube')
      expect(following.host).to.equal(followingHost)

      expect(notification.actorFollow.follower.name).to.equal('peertube')
      expect(notification.actorFollow.follower.host).to.equal(followerHost)
    } else {
      expect(notification).to.satisfy(n => {
        return n.type !== notificationType || n.actorFollow.following.host !== followingHost
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']

    return text.match(/\bautomatically followed\b/) && text.includes(followingHost)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}
