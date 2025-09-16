/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotification, UserNotificationType } from '@peertube/peertube-models'
import { cleanupTests, PeerTubeServer, waitJobs } from '@peertube/peertube-server-commands'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import {
  checkAcceptedToCollaborateToChannel,
  CheckChannelCollaboratorOptions,
  checkInvitedToCollaborateToChannel,
  checkRefusedToCollaborateToChannel
} from '@tests/shared/notifications/check-channel-notifications.js'
import { prepareNotificationsTest } from '@tests/shared/notifications/notifications-common.js'
import { expect } from 'chai'

type BaseParam = Omit<CheckChannelCollaboratorOptions, 'checkType'>

describe('Test channel collaborators notifications', function () {
  let server: PeerTubeServer

  let userNotifications: UserNotification[] = []
  let adminNotifications: UserNotification[] = []
  let emails: object[] = []

  let baseAdminParams: BaseParam
  let baseUserParams: BaseParam

  let userAccessToken: string
  let collaboratorId: number

  const userEmail = 'user_1@example.com'

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(1)
    emails = res.emails
    userAccessToken = res.userAccessToken
    server = res.servers[0]
    userNotifications = res.userNotifications
    adminNotifications = res.adminNotifications

    baseAdminParams = {
      server,
      emails,
      to: server.adminEmail,
      token: server.accessToken,
      socketNotifications: adminNotifications,
      channelDisplayName: 'Main root channel',
      targetDisplayName: 'User 1',
      sourceDisplayName: 'root'
    }
    baseUserParams = {
      server,
      emails,
      to: userEmail,
      token: userAccessToken,
      socketNotifications: userNotifications,
      channelDisplayName: 'Main root channel',
      targetDisplayName: 'User 1',
      sourceDisplayName: 'root'
    }
  })

  describe('Common workflow', function () {
    it('Should send a notification when a user is invited to collaborate to a channel', async function () {
      const res = await server.channelCollaborators.invite({ channel: 'root_channel', target: 'user_1' })
      collaboratorId = res.id

      await waitJobs([ server ])

      await checkInvitedToCollaborateToChannel({ ...baseUserParams, checkType: 'presence' })
      await checkInvitedToCollaborateToChannel({ ...baseAdminParams, checkType: 'absence' })
    })

    it('Should send a notification when a user accepts to collaborate to a channel', async function () {
      await server.channelCollaborators.accept({ id: collaboratorId, token: userAccessToken, channel: 'root_channel' })
      await waitJobs([ server ])

      await checkAcceptedToCollaborateToChannel({ ...baseUserParams, checkType: 'absence' })
      await checkAcceptedToCollaborateToChannel({ ...baseAdminParams, checkType: 'presence' })
    })

    it('Should send a notification when a user refuses to collaborate to a channel', async function () {
      // Re-invite the user
      {
        await server.channelCollaborators.remove({ channel: 'root_channel', id: collaboratorId })
        const res = await server.channelCollaborators.invite({ channel: 'root_channel', target: 'user_1' })
        collaboratorId = res.id
      }

      await server.channelCollaborators.reject({ id: collaboratorId, channel: 'root_channel', token: userAccessToken })
      await waitJobs([ server ])

      await checkRefusedToCollaborateToChannel({ ...baseUserParams, checkType: 'absence' })
      await checkRefusedToCollaborateToChannel({ ...baseAdminParams, checkType: 'presence' })
    })
  })

  describe('With a muted account', function () {
    let muterToken: string
    let checkOptions: Omit<Parameters<typeof checkInvitedToCollaborateToChannel>[0], 'checkType'>
    let collaboratorId: number

    before(async function () {
      muterToken = await server.users.generateUserAndToken('muted_user')

      checkOptions = {
        server,
        emails,
        to: server.adminEmail,
        token: server.accessToken,
        socketNotifications: adminNotifications,
        channelDisplayName: 'Main muted_user channel',
        targetDisplayName: 'root',
        sourceDisplayName: 'muted_user'
      }
    })

    it('Should not send the notification is the source account is muted', async function () {
      await server.users.updateMyAvatar({ token: muterToken, fixture: 'avatar.png' })
      await server.channels.updateImage({ token: muterToken, channelName: 'muted_user_channel', type: 'avatar', fixture: 'avatar.png' })

      await server.blocklist.addToMyBlocklist({ account: 'muted_user' })

      const { id } = await server.channelCollaborators.invite({ channel: 'muted_user_channel', target: 'root', token: muterToken })
      collaboratorId = id

      await waitJobs(server)
      await checkInvitedToCollaborateToChannel({ ...checkOptions, checkType: 'absence' })
    })

    it('Should remove notifications from muted accounts', async function () {
      await server.blocklist.removeFromMyBlocklist({ account: 'muted_user' })

      await server.channelCollaborators.reject({ channel: 'muted_user_channel', id: collaboratorId })
      await server.channelCollaborators.invite({ channel: 'muted_user_channel', target: 'root', token: muterToken })

      await waitJobs(server)
      await checkInvitedToCollaborateToChannel({ ...checkOptions, checkType: 'presence' })

      await server.blocklist.addToMyBlocklist({ account: 'muted_user' })

      const { data } = await server.notifications.list({ token: server.accessToken })

      const notification = data.find(n =>
        n.type === UserNotificationType.INVITED_TO_COLLABORATE_TO_CHANNEL && n.videoChannelCollaborator.channelOwner.name === 'muted_user'
      )
      expect(notification).to.be.undefined
    })
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
