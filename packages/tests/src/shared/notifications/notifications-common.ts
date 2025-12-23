/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import {
  UserNotification,
  UserNotificationSetting,
  UserNotificationSettingValue,
  UserNotificationType_Type
} from '@peertube/peertube-models'
import {
  ConfigCommand,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { MockSmtpServer } from '../mock-servers/mock-email.js'

export function getAllNotificationsSettings (): UserNotificationSetting {
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

export async function waitUntilNotification (options: {
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

export async function prepareNotificationsTest (serversCount = 3, overrideConfigArg: any = {}) {
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
  await servers[0].users.updateMe({ token: userAccessToken, displayName: 'User 1' })

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
