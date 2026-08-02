/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  cleanupTests,
  createSingleServer,
  doubleFollow,
  makeGetRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { HttpStatusCode } from '@peertube/peertube-models'
import { expect } from 'chai'

describe('Test plugin auto taggers', function () {
  let server: PeerTubeServer
  let anotherServer: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    anotherServer = await createSingleServer(2)

    await setAccessTokensToServers([ server, anotherServer ])
    await doubleFollow(server, anotherServer)

    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-seven') })
  })

  describe('Plugin comment auto tagger', function () {
    let videoUUID: string

    before(async function () {
      ;({ uuid: videoUUID } = await server.videos.quickUpload({ name: 'video' }))

      await waitJobs([ server, anotherServer ])
    })

    it('Should list available auto tag names for comments', async function () {
      const { available } = await server.autoTags.getAccountAvailable({ accountName: 'root' })
      expect(available.map(t => t.name)).to.have.members([ 'external-link', 'plugin comment auto tag' ])
    })

    it('Should not assign plugin tag if the plugin does not trigger', async function () {
      await server.comments.createThread({
        videoId: videoUUID,
        text: 'just a normal comment with no trigger'
      })

      {
        const { data } = await server.comments.listForAdmin()
        expect(data.find(c => c.text === 'just a normal comment with no trigger').automaticTags).to.have.lengthOf(0)
      }

      await server.comments.deleteAllComments({ videoUUID })
    })

    it('Should assign the plugin tag as automatic tag when the plugin triggers', async function () {
      await server.comments.createThread({
        videoId: videoUUID,
        text: 'this comment triggers plugin-tag-comment'
      })

      await server.comments.createThread({
        videoId: videoUUID,
        text: 'another comment with plugin-tag-comment trigger'
      })

      {
        const { data } = await server.comments.listForAdmin()
        const c = (text: string) => data.find(c => c.text === text)

        expect(c('this comment triggers plugin-tag-comment').automaticTags).to.have.members([ 'plugin comment auto tag' ])

        expect(c('another comment with plugin-tag-comment trigger').automaticTags).to.have.members([ 'plugin comment auto tag' ])
      }

      await server.comments.deleteAllComments({ videoUUID })
    })

    it('Should assign plugin tag along with watched words and external-link tags', async function () {
      await server.watchedWordsLists.createList({ listName: 'test list', words: [ 'trigger' ], accountName: 'root' })

      await server.comments.createThread({
        videoId: videoUUID,
        text: 'plugin-tag-comment with trigger example.com'
      })

      await anotherServer.comments.createThread({
        videoId: videoUUID,
        text: 'plugin-tag-comment with trigger example.com from remote'
      })

      await waitJobs([ server, anotherServer ])

      {
        const { data } = await server.comments.listForAdmin()
        const t = (text: string) => data.find(c => c.text === text).automaticTags

        expect(t('plugin-tag-comment with trigger example.com')).to.have.members([ 'plugin comment auto tag', 'external-link' ])

        expect(t('plugin-tag-comment with trigger example.com from remote')).to.have.members([
          'plugin comment auto tag',
          'external-link'
        ])
      }

      {
        const { data } = await server.comments.listCommentsOnMyVideos()
        const t = (text: string) => data.find(c => c.text === text).automaticTags

        expect(t('plugin-tag-comment with trigger example.com')).to.have.members([
          'plugin comment auto tag',
          'external-link',
          'test list'
        ])

        expect(
          t('plugin-tag-comment with trigger example.com from remote')
        ).to.have.members([
          'plugin comment auto tag',
          'external-link',
          'test list'
        ])
      }

      await server.comments.deleteAllComments({ videoUUID })
    })
  })

  describe('Plugin video auto tagger', function () {
    before(async function () {
      await server.videos.removeAll()
    })

    it('Should list available auto tag names for videos', async function () {
      const { available } = await server.autoTags.getServerAvailable()
      expect(available.map(t => t.name)).to.have.members([ 'plugin video auto tag', 'external-link' ])
    })

    it('Should not assign plugin tag if no trigger word is in video name or description', async function () {
      await server.videos.upload({ attributes: { name: 'normal video', description: 'normal description' } })

      {
        const { data } = await server.videos.listAllForAdmin()
        expect(data.find(v => v.name === 'normal video').automaticTags).to.have.lengthOf(0)
      }

      await server.videos.removeAll()
    })

    it('Should assign plugin npmName as automatic tag on video with trigger in name', async function () {
      await server.videos.upload({
        attributes: { name: 'video with plugin-tag-video in name', description: 'no trigger' }
      })

      {
        const { data } = await server.videos.listAllForAdmin()
        expect(data.find(v => v.name === 'video with plugin-tag-video in name').automaticTags).to.have.members([ 'plugin video auto tag' ])
      }

      await server.videos.removeAll()
    })

    it('Should assign plugin npmName as automatic tag on video with trigger in description', async function () {
      await server.videos.upload({
        attributes: { name: 'video desc', description: 'contains plugin-tag-video in description' }
      })

      {
        const { data } = await server.videos.listAllForAdmin()
        expect(data.find(v => v.name === 'video desc').automaticTags).to.have.members([ 'plugin video auto tag' ])
      }
    })
  })

  describe('Plugin automatic tags helpers', function () {
    let videoUUID: string
    let commentId: number

    before(async function () {
      ;({ uuid: videoUUID } = await server.videos.quickUpload({ name: 'video for helpers' }))
    })

    it('Should get server comment automatic tags via peertubeHelpers', async function () {
      await server.comments.createThread({
        videoId: videoUUID,
        text: 'plugin-tag-comment for helper test'
      })

      {
        const { data } = await server.comments.listForAdmin()
        const comment = data.find(c => c.text === 'plugin-tag-comment for helper test')
        expect(comment).to.exist
        expect(comment.automaticTags).to.include('plugin comment auto tag')

        commentId = comment.id
      }

      const res = await makeGetRequest({
        url: server.url,
        path: `/plugins/test-seven/0.0.1/router/server-comment-tags/${commentId}`,
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.tags).to.include('plugin comment auto tag')
    })

    it('Should get account comment automatic tags via peertubeHelpers', async function () {
      const { data } = await server.comments.listForAdmin()
      const comment = data.find(c => c.text === 'plugin-tag-comment for helper test')
      expect(comment).to.exist

      const accountId = comment.account.id

      const res = await makeGetRequest({
        url: server.url,
        path: `/plugins/test-seven/0.0.1/router/account-comment-tags/${commentId}?accountId=${accountId}`,
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.tags).to.include('plugin comment auto tag')
    })

    it('Should get server video automatic tags via peertubeHelpers', async function () {
      await server.videos.upload({
        attributes: { name: 'plugin-tag-video for helper', description: 'test' }
      })

      {
        const { data } = await server.videos.listAllForAdmin()
        const video = data.find(v => v.name === 'plugin-tag-video for helper')
        expect(video).to.exist
        expect(video.automaticTags).to.include('plugin video auto tag')

        const res = await makeGetRequest({
          url: server.url,
          path: `/plugins/test-seven/0.0.1/router/server-video-tags/${video.id}`,
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(res.body.tags).to.include('plugin video auto tag')
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])

    if (anotherServer) await cleanupTests([ anotherServer ])
  })
})
