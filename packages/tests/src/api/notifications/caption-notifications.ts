/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotification } from '@peertube/peertube-models'
import { PeerTubeServer, cleanupTests, waitJobs } from '@peertube/peertube-server-commands'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import {
  CheckerBaseParams,
  checkMyVideoTranscriptionGenerated,
  prepareNotificationsTest
} from '@tests/shared/notifications.js'
import { join } from 'path'

describe('Test caption notifications', function () {
  let servers: PeerTubeServer[] = []

  let userNotifications: UserNotification[] = []
  let emails: object[] = []
  let userAccessToken: string

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(1)
    emails = res.emails
    userAccessToken = res.userAccessToken
    servers = res.servers
    userNotifications = res.userNotifications
  })

  describe('Transcription of my video generated is published', function () {
    const language = { id: 'en', label: 'English' }
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }
    })

    async function uploadAndWait () {
      const { uuid } = await servers[0].videos.upload({
        token: userAccessToken,
        attributes: {
          name: 'video',
          fixture: join('transcription', 'videos', 'the_last_man_on_earth.mp4'),
          language: undefined
        }
      })
      await waitJobs(servers)

      return servers[0].videos.get({ id: uuid })
    }

    it('Should not send a notification if transcription is not enabled', async function () {
      this.timeout(50000)

      const { name, shortUUID } = await uploadAndWait()

      await checkMyVideoTranscriptionGenerated({ ...baseParams, videoName: name, shortUUID, language, checkType: 'absence' })
    })

    it('Should send a notification transcription is enabled', async function () {
      this.timeout(240000)

      await servers[0].config.enableTranscription()

      const { name, shortUUID } = await uploadAndWait()

      await checkMyVideoTranscriptionGenerated({ ...baseParams, videoName: name, shortUUID, language, checkType: 'presence' })
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests(servers)
  })
})
