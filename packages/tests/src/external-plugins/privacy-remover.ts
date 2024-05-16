/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Official plugin Privacy Remover', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(30000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await servers[1].config.disableTranscoding()

    await servers[0].plugins.install({
      npmName: 'peertube-plugin-privacy-remover'
    })

    await doubleFollow(servers[0], servers[1])
  })

  describe('When disabling public privacy', function () {

    before(async function () {
      await servers[0].plugins.updateSettings({
        npmName: 'peertube-plugin-privacy-remover',
        settings: {
          'disable-video-public': true
        }
      })
    })

    it('Should not list public privacy anymore', async function () {
      const privacies = await servers[0].videos.getPrivacies()

      expect(privacies[VideoPrivacy.PUBLIC]).to.not.exist
    })

    it('Should not be able to upload a public video', async function () {
      await servers[0].videos.quickUpload({ name: 'public', privacy: VideoPrivacy.PUBLIC, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should not be able to receive a remote public video', async function () {
      await servers[1].videos.quickUpload({ name: 'remote public', privacy: VideoPrivacy.PUBLIC })
      await waitJobs(servers)

      const video = await servers[0].videos.find({ name: 'remote public' })
      expect(video).to.not.exist
    })
  })

  describe('When enabling public privacy', function () {

    before(async function () {
      await servers[0].plugins.updateSettings({
        npmName: 'peertube-plugin-privacy-remover',
        settings: {
          'disable-video-public': false
        }
      })
    })

    it('Should list public privacy', async function () {
      const privacies = await servers[0].videos.getPrivacies()

      expect(privacies[VideoPrivacy.PUBLIC]).to.exist
    })

    it('Should be able to upload a public video', async function () {
      await servers[0].videos.quickUpload({ name: 'public', privacy: VideoPrivacy.PUBLIC })
    })

    it('Should be able to receive a remote public video', async function () {
      await servers[1].videos.quickUpload({ name: 'remote public', privacy: VideoPrivacy.PUBLIC })
      await waitJobs(servers)

      const video = await servers[0].videos.find({ name: 'remote public' })
      expect(video).to.exist
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
