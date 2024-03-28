/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Official plugin Akismet', function () {
  let servers: PeerTubeServer[]
  let videoUUID: string

  before(async function () {
    this.timeout(30000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await servers[0].plugins.install({
      npmName: 'peertube-plugin-akismet'
    })

    if (!process.env.AKISMET_KEY) throw new Error('Missing AKISMET_KEY from env')

    await servers[0].plugins.updateSettings({
      npmName: 'peertube-plugin-akismet',
      settings: {
        'akismet-api-key': process.env.AKISMET_KEY
      }
    })

    await doubleFollow(servers[0], servers[1])
  })

  describe('Local threads/replies', function () {

    before(async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video 1' })
      videoUUID = uuid
    })

    it('Should not detect a thread as spam', async function () {
      await servers[0].comments.createThread({ videoId: videoUUID, text: 'comment' })
    })

    it('Should not detect a reply as spam', async function () {
      await servers[0].comments.addReplyToLastThread({ text: 'reply' })
    })

    it('Should detect a thread as spam', async function () {
      await servers[0].comments.createThread({
        videoId: videoUUID,
        text: 'akismet-guaranteed-spam',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should detect a thread as spam', async function () {
      await servers[0].comments.createThread({ videoId: videoUUID, text: 'comment' })
      await servers[0].comments.addReplyToLastThread({ text: 'akismet-guaranteed-spam', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })
  })

  describe('Remote threads/replies', function () {

    before(async function () {
      this.timeout(60000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video 1' })
      videoUUID = uuid

      await waitJobs(servers)
    })

    it('Should not detect a thread as spam', async function () {
      this.timeout(30000)

      await servers[1].comments.createThread({ videoId: videoUUID, text: 'remote comment 1' })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listThreads({ videoId: videoUUID })
      expect(data).to.have.lengthOf(1)
    })

    it('Should not detect a reply as spam', async function () {
      this.timeout(30000)

      await servers[1].comments.addReplyToLastThread({ text: 'I agree with you' })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listThreads({ videoId: videoUUID })
      expect(data).to.have.lengthOf(1)

      const tree = await servers[0].comments.getThread({ videoId: videoUUID, threadId: data[0].id })
      expect(tree.children).to.have.lengthOf(1)
    })

    it('Should detect a thread as spam', async function () {
      this.timeout(30000)

      await servers[1].comments.createThread({ videoId: videoUUID, text: 'akismet-guaranteed-spam' })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listThreads({ videoId: videoUUID })
      expect(data).to.have.lengthOf(1)
    })

    it('Should detect a thread as spam', async function () {
      this.timeout(30000)

      await servers[1].comments.addReplyToLastThread({ text: 'akismet-guaranteed-spam' })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listThreads({ videoId: videoUUID })
      expect(data).to.have.lengthOf(1)

      const thread = data[0]
      const tree = await servers[0].comments.getThread({ videoId: videoUUID, threadId: thread.id })
      expect(tree.children).to.have.lengthOf(1)
    })
  })

  describe('Signup', function () {

    before(async function () {
      await servers[0].config.updateExistingConfig({
        newConfig: {
          signup: {
            enabled: true
          }
        }
      })
    })

    it('Should allow signup', async function () {
      await servers[0].registrations.register({
        username: 'user1',
        displayName: 'user 1'
      })
    })

    it('Should detect a signup as SPAM', async function () {
      await servers[0].registrations.register({
        username: 'user2',
        displayName: 'user 2',
        email: 'akismet-guaranteed-spam@example.com',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
