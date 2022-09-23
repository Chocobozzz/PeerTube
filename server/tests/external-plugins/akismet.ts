/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

describe('Official plugin Akismet', function () {
  let servers: PeerTubeServer[]
  let videoUUID: string

  before(async function () {
    this.timeout(30000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await servers[0].plugins.install({ npmName: 'peertube-plugin-akismet' })

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

      await servers[1].comments.createThread({ videoId: videoUUID, text: 'remote comment 2' })
      await servers[1].comments.addReplyToLastThread({ text: 'akismet-guaranteed-spam' })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listThreads({ videoId: videoUUID })
      expect(data).to.have.lengthOf(2)

      for (const thread of data) {
        const tree = await servers[0].comments.getThread({ videoId: videoUUID, threadId: thread.id })
        if (tree.comment.text === 'remote comment 1') continue

        expect(tree.children).to.have.lengthOf(0)
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
