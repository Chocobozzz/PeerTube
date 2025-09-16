/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotification, UserNotificationType } from '@peertube/peertube-models'
import { expect } from 'chai'
import { checkActor, CheckerBaseParams, CheckerType, checkNotification, checkVideo } from './shared/notification-checker.js'

export async function checkNewVideoFromSubscription (
  options: CheckerBaseParams & {
    videoName: string
    shortUUID: string
    checkType: CheckerType
  }
) {
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

export async function checkNewLiveFromSubscription (
  options: CheckerBaseParams & {
    videoName: string
    shortUUID: string
    checkType: CheckerType
  }
) {
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

export async function checkMyVideoIsPublished (
  options: CheckerBaseParams & {
    videoName: string
    shortUUID: string
    checkType: CheckerType
  }
) {
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

export async function checkVideoStudioEditionIsFinished (
  options: CheckerBaseParams & {
    videoName: string
    shortUUID: string
    checkType: CheckerType
  }
) {
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

export async function checkMyVideoImportIsFinished (
  options: CheckerBaseParams & {
    videoName: string
    shortUUID: string
    url: string
    success: boolean
    checkType: CheckerType
  }
) {
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
    const toFind = success
      ? /\bfinished\b/
      : /\berror\b/

    return text.includes(url) && !!text.match(toFind)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkMyVideoTranscriptionGenerated (
  options: CheckerBaseParams & {
    videoName: string
    shortUUID: string
    language: {
      id: string
      label: string
    }
    checkType: CheckerType
  }
) {
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
