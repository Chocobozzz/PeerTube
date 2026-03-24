/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { PeerTubeServer, cleanupTests, createMultipleServers, setAccessTokensToServers, waitJobs } from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test forwarding activities', function () {
  let servers: PeerTubeServer[] = []
  const threadText = 'This is a comment'
  let videoUUID = ''

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    await servers[0].follows.follow({ hosts: [ servers[1].host ] })
    await servers[2].follows.follow({ hosts: [ servers[1].host ] })

    await servers[1].config.disableTranscoding()

    const { uuid } = await servers[1].videos.quickUpload({ name: 'video' })
    videoUUID = uuid

    await waitJobs(servers)
  })

  it('Should correctly forward rates', async function () {
    await servers[0].videos.rate({ id: videoUUID, rating: 'dislike' })
    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: videoUUID })

      expect(video.dislikes).to.equal(1)
    }
  })

  it('Should correctly forward comments to followers', async function () {
    await servers[0].comments.createThread({ videoId: videoUUID, text: threadText })

    await waitJobs(servers)

    for (const server of servers) {
      const { data } = await server.comments.listThreads({ videoId: videoUUID })

      expect(data[0].text).to.equal(threadText)
    }
  })

  it('Should correctly forward comments to mentions', async function () {
    await servers[0].follows.unfollow({ target: servers[1] })
    await waitJobs(servers)

    {
      const threadId = await servers[0].comments.findCommentId({ text: threadText, videoId: videoUUID })
      await servers[2].comments.addReply({ videoId: videoUUID, toCommentId: threadId, text: 'reply' })
      await waitJobs(servers)
    }

    for (const server of servers) {
      const threadId = await server.comments.findCommentId({ text: threadText, videoId: videoUUID })
      const { children } = await server.comments.getThread({ videoId: videoUUID, threadId })

      expect(children[0].comment.text).to.equal('reply')
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
