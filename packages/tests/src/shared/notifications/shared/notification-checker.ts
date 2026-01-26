/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotification } from '@peertube/peertube-models'
import { PeerTubeServer } from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { inspect } from 'util'

export type CheckerBaseParams = {
  server: PeerTubeServer
  emails: any[]
  socketNotifications: UserNotification[]
  token: string
  check?: { web: boolean, mail: boolean }
}

export type CheckerType = 'presence' | 'absence'

export async function checkNotification (
  options: CheckerBaseParams & {
    notificationChecker: (notification: UserNotification, checkType: CheckerType) => void
    emailNotificationFinder: (email: object) => boolean
    checkType: CheckerType
  }
) {
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
      .map(e => ({
        ...e,

        text: (e.text as string).replaceAll('\n', ' ')
      }))
      .find(e => emailNotificationFinder(e))

    if (checkType === 'presence') {
      const texts = emails.map(e => (e.text as string).replaceAll('\n', ' '))
      expect(email, 'The email is absent when is should be present. ' + inspect(texts)).to.not.be.undefined
    } else {
      expect(email, 'The email is present when is should not be present. ' + inspect(email)).to.be.undefined
    }
  }
}

export function checkVideo (video: any, videoName?: string, shortUUID?: string) {
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

  expect(video.state).to.exist
  expect(video.id).to.be.a('number')
}

export function checkActor (actor: any, options: { withAvatar?: boolean } = {}) {
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

export function checkComment (comment: any, commentId: number, threadId: number) {
  expect(comment.id).to.equal(commentId)
  expect(comment.threadId).to.equal(threadId)
}
