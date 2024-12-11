/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  AbuseState,
  AbuseStateType,
  PluginType_Type,
  UserNotification,
  UserNotificationSetting,
  UserNotificationSettingValue,
  UserNotificationType,
  UserNotificationType_Type
} from '@peertube/peertube-models'
import {
  ConfigCommand,
  PeerTubeServer,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { inspect } from 'util'
import { MockSmtpServer } from './mock-servers/index.js'
import { wait } from '@peertube/peertube-core-utils'

type CheckerBaseParams = {
  server: PeerTubeServer
  emails: any[]
  socketNotifications: UserNotification[]
  token: string
  check?: { web: boolean, mail: boolean }
}

type CheckerType = 'presence' | 'absence'

function getAllNotificationsSettings (): UserNotificationSetting {
  return {
    newVideoFromSubscription: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newCommentOnMyVideo: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    abuseAsModerator: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    videoAutoBlacklistAsModerator: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    blacklistOnMyVideo: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    myVideoImportFinished: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    myVideoPublished: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    commentMention: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newFollow: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newUserRegistration: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newInstanceFollower: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    abuseNewMessage: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    abuseStateChange: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    autoInstanceFollowing: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newPeerTubeVersion: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    myVideoStudioEditionFinished: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    myVideoTranscriptionGenerated: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newPluginVersion: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
  }
}

async function waitUntilNotification (options: {
  server: PeerTubeServer
  notificationType: UserNotificationType_Type
  token: string
  fromDate: Date
}) {
  const { server, fromDate, notificationType, token } = options

  do {
    const { data } = await server.notifications.list({ start: 0, count: 5, token })
    if (data.some(n => n.type === notificationType && new Date(n.createdAt) >= fromDate)) break

    await wait(500)
  } while (true)

  await waitJobs([ server ])
}

async function checkNewVideoFromSubscription (options: CheckerBaseParams & {
  videoName: string
  shortUUID: string
  checkType: CheckerType
}) {
  const { videoName, shortUUID } = options
  const notificationType = UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      checkVideo(notification.video, videoName, shortUUID)
      checkActor(notification.video.channel)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n === undefined || n.type !== UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION || n.video.name !== videoName
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(shortUUID) !== -1 && text.indexOf('Your subscription') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkNewLiveFromSubscription (options: CheckerBaseParams & {
  videoName: string
  shortUUID: string
  checkType: CheckerType
}) {
  const { videoName, shortUUID } = options
  const notificationType = UserNotificationType.NEW_LIVE_FROM_SUBSCRIPTION

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      checkVideo(notification.video, videoName, shortUUID)
      checkActor(notification.video.channel)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n === undefined || n.type !== UserNotificationType.NEW_LIVE_FROM_SUBSCRIPTION || n.video.name !== videoName
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(shortUUID) !== -1 && text.indexOf('Your subscription') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkMyVideoIsPublished (options: CheckerBaseParams & {
  videoName: string
  shortUUID: string
  checkType: CheckerType
}) {
  const { videoName, shortUUID } = options
  const notificationType = UserNotificationType.MY_VIDEO_PUBLISHED

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      checkVideo(notification.video, videoName, shortUUID)
      checkActor(notification.video.channel)
    } else {
      expect(notification.video).to.satisfy(v => v === undefined || v.name !== videoName)
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']
    return text.includes(shortUUID) && text.includes('Your video')
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkVideoStudioEditionIsFinished (options: CheckerBaseParams & {
  videoName: string
  shortUUID: string
  checkType: CheckerType
}) {
  const { videoName, shortUUID } = options
  const notificationType = UserNotificationType.MY_VIDEO_STUDIO_EDITION_FINISHED

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      checkVideo(notification.video, videoName, shortUUID)
      checkActor(notification.video.channel)
    } else {
      expect(notification.video).to.satisfy(v => v === undefined || v.name !== videoName)
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']
    return text.includes(shortUUID) && text.includes('Edition of your video')
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkMyVideoImportIsFinished (options: CheckerBaseParams & {
  videoName: string
  shortUUID: string
  url: string
  success: boolean
  checkType: CheckerType
}) {
  const { videoName, shortUUID, url, success } = options

  const notificationType = success ? UserNotificationType.MY_VIDEO_IMPORT_SUCCESS : UserNotificationType.MY_VIDEO_IMPORT_ERROR

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.videoImport.targetUrl).to.equal(url)

      if (success) checkVideo(notification.videoImport.video, videoName, shortUUID)
    } else {
      expect(notification.videoImport).to.satisfy(i => i === undefined || i.targetUrl !== url)
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']
    const toFind = success ? ' finished' : ' error'

    return text.includes(url) && text.includes(toFind)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

// ---------------------------------------------------------------------------

async function checkUserRegistered (options: CheckerBaseParams & {
  username: string
  checkType: CheckerType
}) {
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

async function checkRegistrationRequest (options: CheckerBaseParams & {
  username: string
  registrationReason: string
  checkType: CheckerType
}) {
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

// ---------------------------------------------------------------------------

async function checkNewActorFollow (options: CheckerBaseParams & {
  followType: 'channel' | 'account'
  followerName: string
  followerDisplayName: string
  followingDisplayName: string
  checkType: CheckerType
}) {
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

async function checkNewInstanceFollower (options: CheckerBaseParams & {
  followerHost: string
  checkType: CheckerType
}) {
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

    return text.includes('instance has a new follower') && text.includes(followerHost)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkAutoInstanceFollowing (options: CheckerBaseParams & {
  followerHost: string
  followingHost: string
  checkType: CheckerType
}) {
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

    return text.includes(' automatically followed a new instance') && text.includes(followingHost)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkCommentMention (options: CheckerBaseParams & {
  shortUUID: string
  commentId: number
  threadId: number
  byAccountDisplayName: string
  checkType: CheckerType
}) {
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

    return text.includes(' mentioned ') && text.includes(shortUUID) && text.includes(byAccountDisplayName)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

let lastEmailCount = 0

async function checkNewCommentOnMyVideo (options: CheckerBaseParams & {
  shortUUID: string
  commentId: number
  threadId: number
  checkType: CheckerType
  approval?: boolean // default false
}) {
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
        return n?.comment === undefined || n.comment.id !== commentId
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

async function checkNewVideoAbuseForModerators (options: CheckerBaseParams & {
  shortUUID: string
  videoName: string
  checkType: CheckerType
}) {
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
        return n?.abuse === undefined || n.abuse.video.shortUUID !== shortUUID
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(shortUUID) !== -1 && text.indexOf('abuse') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkNewAbuseMessage (options: CheckerBaseParams & {
  abuseId: number
  message: string
  toEmail: string
  checkType: CheckerType
}) {
  const { abuseId, message, toEmail } = options
  const notificationType = UserNotificationType.ABUSE_NEW_MESSAGE

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.abuse.id).to.equal(abuseId)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n === undefined || n.type !== notificationType || n.abuse === undefined || n.abuse.id !== abuseId
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

async function checkAbuseStateChange (options: CheckerBaseParams & {
  abuseId: number
  state: AbuseStateType
  checkType: CheckerType
}) {
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
        return n?.abuse === undefined || n.abuse.id !== abuseId
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

async function checkNewCommentAbuseForModerators (options: CheckerBaseParams & {
  shortUUID: string
  videoName: string
  checkType: CheckerType
}) {
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
        return n?.abuse === undefined || n.abuse.comment.video.shortUUID !== shortUUID
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(shortUUID) !== -1 && text.indexOf('abuse') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkNewAccountAbuseForModerators (options: CheckerBaseParams & {
  displayName: string
  checkType: CheckerType
}) {
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
        return n?.abuse === undefined || n.abuse.account.displayName !== displayName
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(displayName) !== -1 && text.indexOf('abuse') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkVideoAutoBlacklistForModerators (options: CheckerBaseParams & {
  shortUUID: string
  videoName: string
  checkType: CheckerType
}) {
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
        return n?.video === undefined || n.video.shortUUID !== shortUUID
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']
    return text.indexOf(shortUUID) !== -1 && email['text'].indexOf('moderation/video-blocklist') !== -1
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkNewBlacklistOnMyVideo (options: CheckerBaseParams & {
  shortUUID: string
  videoName: string
  blacklistType: 'blacklist' | 'unblacklist'
}) {
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
    const text = email['text']
    const blacklistText = blacklistType === 'blacklist'
      ? 'blacklisted'
      : 'unblacklisted'

    return text.includes(shortUUID) && text.includes(blacklistText)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder, checkType: 'presence' })
}

async function checkNewPeerTubeVersion (options: CheckerBaseParams & {
  latestVersion: string
  checkType: CheckerType
}) {
  const { latestVersion } = options
  const notificationType = UserNotificationType.NEW_PEERTUBE_VERSION

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.peertube).to.exist
      expect(notification.peertube.latestVersion).to.equal(latestVersion)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.peertube === undefined || n.peertube.latestVersion !== latestVersion
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']

    return text.includes(latestVersion)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkNewPluginVersion (options: CheckerBaseParams & {
  pluginType: PluginType_Type
  pluginName: string
  checkType: CheckerType
}) {
  const { pluginName, pluginType } = options
  const notificationType = UserNotificationType.NEW_PLUGIN_VERSION

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.plugin.name).to.equal(pluginName)
      expect(notification.plugin.type).to.equal(pluginType)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.plugin === undefined || n.plugin.name !== pluginName
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']

    return text.includes(pluginName)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function checkMyVideoTranscriptionGenerated (options: CheckerBaseParams & {
  videoName: string
  shortUUID: string
  language: {
    id: string
    label: string
  }
  checkType: CheckerType
}) {
  const { videoName, shortUUID, language } = options
  const notificationType = UserNotificationType.MY_VIDEO_TRANSCRIPTION_GENERATED

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.videoCaption).to.exist
      expect(notification.videoCaption.language.id).to.equal(language.id)
      expect(notification.videoCaption.language.label).to.equal(language.label)
      checkVideo(notification.videoCaption.video, videoName, shortUUID)
    } else {
      expect(notification.videoCaption).to.satisfy(c => c === undefined || c.Video.shortUUID !== shortUUID)
    }
  }

  function emailNotificationFinder (email: object) {
    const text: string = email['text']
    return text.includes(shortUUID) && text.includes('Transcription in ' + language.label)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

async function prepareNotificationsTest (serversCount = 3, overrideConfigArg: any = {}) {
  const userNotifications: UserNotification[] = []
  const adminNotifications: UserNotification[] = []
  const adminNotificationsServer2: UserNotification[] = []
  const emails: object[] = []

  const port = await MockSmtpServer.Instance.collectEmails(emails)

  const overrideConfig = {
    ...ConfigCommand.getEmailOverrideConfig(port),

    signup: {
      limit: 20
    }
  }
  const servers = await createMultipleServers(serversCount, Object.assign(overrideConfig, overrideConfigArg))

  await setAccessTokensToServers(servers)
  await setDefaultVideoChannel(servers)
  await setDefaultChannelAvatar(servers)
  await setDefaultAccountAvatar(servers)

  if (servers[1]) {
    await servers[1].config.enableStudio()
    await servers[1].config.enableLive({ allowReplay: true, transcoding: false })
  }

  if (serversCount > 1) {
    await doubleFollow(servers[0], servers[1])
  }

  const user = { username: 'user_1', password: 'super password' }
  await servers[0].users.create({ ...user, videoQuota: 10 * 1000 * 1000 })
  const userAccessToken = await servers[0].login.getAccessToken(user)

  await servers[0].notifications.updateMySettings({ token: userAccessToken, settings: getAllNotificationsSettings() })
  await servers[0].users.updateMyAvatar({ token: userAccessToken, fixture: 'avatar.png' })
  await servers[0].channels.updateImage({ channelName: 'user_1_channel', token: userAccessToken, fixture: 'avatar.png', type: 'avatar' })

  await servers[0].notifications.updateMySettings({ settings: getAllNotificationsSettings() })

  if (serversCount > 1) {
    await servers[1].notifications.updateMySettings({ settings: getAllNotificationsSettings() })
  }

  {
    const socket = servers[0].socketIO.getUserNotificationSocket({ token: userAccessToken })
    socket.on('new-notification', n => userNotifications.push(n))
  }
  {
    const socket = servers[0].socketIO.getUserNotificationSocket()
    socket.on('new-notification', n => adminNotifications.push(n))
  }

  if (serversCount > 1) {
    const socket = servers[1].socketIO.getUserNotificationSocket()
    socket.on('new-notification', n => adminNotificationsServer2.push(n))
  }

  const { videoChannels } = await servers[0].users.getMyInfo()
  const channelId = videoChannels[0].id

  return {
    userNotifications,
    adminNotifications,
    adminNotificationsServer2,
    userAccessToken,
    emails,
    servers,
    channelId,
    baseOverrideConfig: overrideConfig
  }
}

// ---------------------------------------------------------------------------

export {
  type CheckerType,
  type CheckerBaseParams,

  getAllNotificationsSettings,

  waitUntilNotification,

  checkMyVideoImportIsFinished,
  checkUserRegistered,
  checkAutoInstanceFollowing,
  checkMyVideoIsPublished,
  checkNewLiveFromSubscription,
  checkNewVideoFromSubscription,
  checkNewActorFollow,
  checkNewCommentOnMyVideo,
  checkNewBlacklistOnMyVideo,
  checkCommentMention,
  checkNewVideoAbuseForModerators,
  checkVideoAutoBlacklistForModerators,
  checkNewAbuseMessage,
  checkAbuseStateChange,
  checkNewInstanceFollower,
  prepareNotificationsTest,
  checkNewCommentAbuseForModerators,
  checkNewAccountAbuseForModerators,
  checkNewPeerTubeVersion,
  checkNewPluginVersion,
  checkVideoStudioEditionIsFinished,
  checkRegistrationRequest,
  checkMyVideoTranscriptionGenerated
}

// ---------------------------------------------------------------------------

async function checkNotification (options: CheckerBaseParams & {
  notificationChecker: (notification: UserNotification, checkType: CheckerType) => void
  emailNotificationFinder: (email: object) => boolean
  checkType: CheckerType
}) {
  const { server, token, checkType, notificationChecker, emailNotificationFinder, socketNotifications, emails } = options

  const check = options.check || { web: true, mail: true }

  if (check.web) {
    const notification = await server.notifications.getLatest({ token })

    if (notification || checkType !== 'absence') {
      notificationChecker(notification, checkType)
    }

    const socketNotification = socketNotifications.find(n => {
      try {
        notificationChecker(n, 'presence')
        return true
      } catch {
        return false
      }
    })

    if (checkType === 'presence') {
      const obj = inspect(socketNotifications, { depth: 5 })
      expect(socketNotification, 'The socket notification is absent when it should be present. ' + obj).to.not.be.undefined
    } else {
      const obj = inspect(socketNotification, { depth: 5 })
      expect(socketNotification, 'The socket notification is present when it should not be present. ' + obj).to.be.undefined
    }
  }

  if (check.mail) {
    // Last email
    const email = emails.slice()
      .reverse()
      .find(e => emailNotificationFinder(e))

    if (checkType === 'presence') {
      const texts = emails.map(e => e.text)
      expect(email, 'The email is absent when is should be present. ' + inspect(texts)).to.not.be.undefined
    } else {
      expect(email, 'The email is present when is should not be present. ' + inspect(email)).to.be.undefined
    }
  }
}

function checkVideo (video: any, videoName?: string, shortUUID?: string) {
  if (videoName) {
    expect(video.name).to.be.a('string')
    expect(video.name).to.not.be.empty
    expect(video.name).to.equal(videoName)
  }

  if (shortUUID) {
    expect(video.shortUUID).to.be.a('string')
    expect(video.shortUUID).to.not.be.empty
    expect(video.shortUUID).to.equal(shortUUID)
  }

  expect(video.id).to.be.a('number')
}

function checkActor (actor: any, options: { withAvatar?: boolean } = {}) {
  const { withAvatar = true } = options

  expect(actor.displayName).to.be.a('string')
  expect(actor.displayName).to.not.be.empty
  expect(actor.host).to.not.be.undefined

  if (withAvatar) {
    expect(actor.avatars).to.be.an('array')
    expect(actor.avatars).to.have.lengthOf(4)
    expect(actor.avatars[0].path).to.exist.and.not.empty
  }
}

function checkComment (comment: any, commentId: number, threadId: number) {
  expect(comment.id).to.equal(commentId)
  expect(comment.threadId).to.equal(threadId)
}
