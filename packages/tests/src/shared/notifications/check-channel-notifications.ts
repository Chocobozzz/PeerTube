/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  UserNotification,
  UserNotificationType,
  UserNotificationType_Type,
  VideoChannelCollaboratorState,
  VideoChannelCollaboratorStateType
} from '@peertube/peertube-models'
import { expect } from 'chai'
import { checkActor, CheckerBaseParams, CheckerType, checkNotification } from './shared/notification-checker.js'

export type CheckChannelCollaboratorOptions = CheckerBaseParams & {
  channelDisplayName: string
  targetDisplayName: string
  sourceDisplayName: string
  checkType: CheckerType
  to: string
}

export async function checkInvitedToCollaborateToChannel (options: CheckChannelCollaboratorOptions) {
  const { channelDisplayName, targetDisplayName, sourceDisplayName, to } = options
  const notificationType = UserNotificationType.INVITED_TO_COLLABORATE_TO_CHANNEL

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      checkCollaboratorNotification({
        notification,
        notificationType,
        channelDisplayName,
        targetDisplayName,
        sourceDisplayName,
        state: VideoChannelCollaboratorState.PENDING
      })
    } else {
      expect(notification).to.satisfy(c => isNotificationAbsent(c))
    }
  }

  function emailNotificationFinder (email: object) {
    if (email['to'][0]['address'] !== to) return false

    const text: string = email['text']
    return text.includes(`${sourceDisplayName} invited you`) &&
      text.includes(`of channel ${channelDisplayName}`)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkAcceptedToCollaborateToChannel (options: CheckChannelCollaboratorOptions) {
  const { channelDisplayName, targetDisplayName, sourceDisplayName, to } = options
  const notificationType = UserNotificationType.ACCEPTED_TO_COLLABORATE_TO_CHANNEL

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      checkCollaboratorNotification({
        notification,
        notificationType,
        channelDisplayName,
        targetDisplayName,
        sourceDisplayName,
        state: VideoChannelCollaboratorState.ACCEPTED
      })
    } else {
      expect(notification).to.satisfy(c => isNotificationAbsent(c))
    }
  }

  function emailNotificationFinder (email: object) {
    if (email['to'][0]['address'] !== to) return false

    const text: string = email['text']
    return text.includes(`${targetDisplayName} accepted`) &&
      text.includes(`of ${channelDisplayName}`)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkRefusedToCollaborateToChannel (options: CheckChannelCollaboratorOptions) {
  const { channelDisplayName, targetDisplayName, sourceDisplayName, to } = options
  const notificationType = UserNotificationType.REFUSED_TO_COLLABORATE_TO_CHANNEL

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      checkCollaboratorNotification({
        notification,
        notificationType,
        channelDisplayName,
        targetDisplayName,
        sourceDisplayName,
        state: VideoChannelCollaboratorState.REJECTED
      })
    } else {
      expect(notification).to.satisfy(c => isNotificationAbsent(c))
    }
  }

  function emailNotificationFinder (email: object) {
    if (email['to'][0]['address'] !== to) return false

    const text: string = email['text']
    return text.includes(`${targetDisplayName} refused`) &&
      text.includes(`of ${channelDisplayName}`)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function checkCollaboratorNotification (options: {
  notification: UserNotification
  notificationType: UserNotificationType_Type
  channelDisplayName: string
  targetDisplayName: string
  sourceDisplayName: string
  state?: VideoChannelCollaboratorStateType
}) {
  const { channelDisplayName, targetDisplayName, notificationType, notification, state, sourceDisplayName } = options

  expect(notification).to.exist
  expect(notification.type).to.equal(notificationType)

  const collaborator = notification.videoChannelCollaborator

  expect(collaborator.channel.avatars).to.have.lengthOf(4)
  expect(collaborator.account.avatars).to.have.lengthOf(4)
  expect(collaborator.id).to.exist
  expect(collaborator.state.id).to.equal(state)
  expect(collaborator.account.displayName).to.equal(targetDisplayName)
  expect(collaborator.channel.displayName).to.equal(channelDisplayName)
  expect(collaborator.channelOwner.displayName).to.equal(sourceDisplayName)

  expect(collaborator.account.name).to.exist
  expect(collaborator.channel.name).to.exist
  expect(collaborator.channelOwner.name).to.exist

  checkActor(collaborator.account)
  checkActor(collaborator.channel)
}

function isNotificationAbsent (options: {
  notification: UserNotification
  notificationType: UserNotificationType_Type
  channelDisplayName: string
  targetDisplayName: string
}) {
  const { notification: n, notificationType, channelDisplayName, targetDisplayName } = options

  if (!n) return true
  if (!n.videoChannelCollaborator) return true
  if (n.type !== notificationType) return true

  if (
    n.videoChannelCollaborator.account.displayName !== targetDisplayName &&
    n.videoChannelCollaborator.channel.displayName !== channelDisplayName
  ) return true

  return false
}
