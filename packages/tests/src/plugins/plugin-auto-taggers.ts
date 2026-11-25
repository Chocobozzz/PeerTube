/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  cleanupTests,
  createSingleServer,
  doubleFollow,
  findExternalSavedVideo,
  makeGetRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers,
  waitUntilLiveReplacedByReplayOnAllServers,
  waitUntilLiveWaitingOnAllServers
} from '@peertube/peertube-server-commands'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
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
      expect(available.map(t => t.name)).to.have.members([
        'external-link',
        'plugin comment auto tag',
        'plugin slow comment auto tag',
        'plugin comment trigger auto tag'
      ])
    })

    it('Should not block the comment creation while a slow auto tagger is running', async function () {
      this.timeout(30000)

      const before = new Date().getTime()
      await server.comments.createThread({ videoId: videoUUID, text: 'a comment with plugin-slow-tag-comment' })
      const duration = new Date().getTime() - before

      expect(duration).to.be.below(2000)

      await waitJobs([ server ])

      {
        const { data } = await server.comments.listForAdmin()
        const comment = data.find(c => c.text === 'a comment with plugin-slow-tag-comment')

        expect(comment.automaticTags).to.have.members([ 'plugin slow comment auto tag' ])
      }

      await server.comments.deleteAllComments({ videoUUID })
    })

    it('Should not assign plugin tag if the plugin does not trigger', async function () {
      await server.comments.createThread({
        videoId: videoUUID,
        text: 'just a normal comment with no trigger'
      })

      await waitJobs([ server ])

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

      await waitJobs([ server ])

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

    it('Should run auto taggers with the trigger and the current tags', async function () {
      const text = 'comment record-trigger'
      const triggerTag = 'plugin comment trigger auto tag'

      const getCalls = async () => {
        const res = await makeGetRequest({
          url: server.url,
          path: '/plugins/test-seven/0.0.1/router/comment-auto-tagger-calls',
          query: { text },
          expectedStatus: HttpStatusCode.OK_200
        })

        return res.body.calls as { trigger: string, currentTags: string[] }[]
      }

      const checkTags = async () => {
        {
          const { data } = await server.comments.listForAdmin()
          expect(data.find(c => c.text === text).automaticTags).to.include(triggerTag)
        }

        {
          const { data } = await server.comments.listCommentsOnMyVideos()
          expect(data.find(c => c.text === text).automaticTags).to.include(triggerTag)
        }
      }

      await server.comments.createThread({ videoId: videoUUID, text })
      await waitJobs([ server ])

      expect(await getCalls()).to.deep.equal([ { trigger: 'new-comment', currentTags: [] } ])
      await checkTags()

      // Watched words of the video owner
      await server.watchedWordsLists.createList({ listName: 'comment trigger list', words: [ 'not in the comment' ], accountName: 'root' })
      await waitJobs([ server ])

      {
        const calls = await getCalls()
        expect(calls).to.have.lengthOf(2)
        expect(calls[1]).to.deep.equal({ trigger: 'rebuild', currentTags: [ triggerTag ] })
      }

      // Watched words of the instance
      const { watchedWordsList } = await server.watchedWordsLists.createList({
        listName: 'comment trigger list',
        words: [ 'not in the comment' ]
      })
      await waitJobs([ server ])

      {
        const calls = await getCalls()
        expect(calls).to.have.lengthOf(3)
        expect(calls[2]).to.deep.equal({ trigger: 'rebuild', currentTags: [ triggerTag ] })
      }

      // The auto tagger kept its tag without analyzing the comment
      await checkTags()

      await server.comments.deleteAllComments({ videoUUID })
      await server.watchedWordsLists.deleteList({ listId: watchedWordsList.id })
      await waitJobs([ server ])
    })
  })

  describe('Plugin video auto tagger', function () {
    before(async function () {
      await server.videos.removeAll()
    })

    it('Should list available auto tag names for videos', async function () {
      const { available } = await server.autoTags.getServerAvailable()
      expect(available.map(t => t.name)).to.have.members([
        'plugin video auto tag',
        'plugin video file auto tag',
        'plugin video trigger auto tag',
        'external-link'
      ])
    })

    it('Should assign a tag decided by an auto tagger that analyzed the video file', async function () {
      this.timeout(60000)

      await server.videos.upload({ attributes: { name: 'video with analyze-video-file', description: 'no trigger' } })

      await waitJobs([ server ])

      {
        const { data } = await server.videos.listAllForAdmin()
        const video = data.find(v => v.name === 'video with analyze-video-file')

        expect(video.automaticTags).to.have.members([ 'plugin video file auto tag' ])
      }

      await server.videos.removeAll()
    })

    it('Should not assign plugin tag if no trigger word is in video name or description', async function () {
      await server.videos.upload({ attributes: { name: 'normal video', description: 'normal description' } })

      await waitJobs([ server ])

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

      await waitJobs([ server ])

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

      await waitJobs([ server ])

      {
        const { data } = await server.videos.listAllForAdmin()
        expect(data.find(v => v.name === 'video desc').automaticTags).to.have.members([ 'plugin video auto tag' ])
      }
    })
  })

  describe('Video auto tagger trigger', function () {
    const triggerTag = 'plugin video trigger auto tag'

    async function getCalls (videoId: number) {
      const res = await makeGetRequest({
        url: server.url,
        path: `/plugins/test-seven/0.0.1/router/video-auto-tagger-calls/${videoId}`,
        expectedStatus: HttpStatusCode.OK_200
      })

      return res.body.calls as { trigger: string, currentTags: string[] }[]
    }

    async function getAutomaticTags (videoUUID: string) {
      const { data } = await server.videos.listAllForAdmin()

      return data.find(v => v.uuid === videoUUID).automaticTags
    }

    before(async function () {
      await server.config.enableFileUpdate()
      await anotherServer.config.enableFileUpdate()
    })

    describe('Local video', function () {
      let videoId: number
      let videoUUID: string

      it('Should run auto taggers with the new-video trigger on upload', async function () {
        this.timeout(60000)
        ;({ id: videoId, uuid: videoUUID } = await server.videos.quickUpload({ name: 'local record-trigger' }))
        await waitJobs([ server ])

        expect(await getCalls(videoId)).to.deep.equal([ { trigger: 'new-video', currentTags: [] } ])
        expect(await getAutomaticTags(videoUUID)).to.have.members([ triggerTag ])
      })

      it('Should run auto taggers with the metadata trigger and the current tags on name update', async function () {
        await server.videos.update({ id: videoUUID, attributes: { name: 'local record-trigger updated' } })
        await waitJobs([ server ])

        const calls = await getCalls(videoId)
        expect(calls).to.have.lengthOf(2)
        expect(calls[1]).to.deep.equal({ trigger: 'metadata', currentTags: [ triggerTag ] })

        // The auto tagger kept its tag without analyzing the files
        expect(await getAutomaticTags(videoUUID)).to.have.members([ triggerTag ])
      })

      it('Should not run auto taggers if the name and the description did not change', async function () {
        await server.videos.update({ id: videoUUID, attributes: { support: 'new support' } })
        await waitJobs([ server ])

        expect(await getCalls(videoId)).to.have.lengthOf(2)
      })

      it('Should run auto taggers with the new-file trigger on source replacement', async function () {
        this.timeout(120000)

        await server.videos.replaceSourceFile({ videoId: videoUUID, fixture: 'video_short.webm' })
        await waitJobs([ server ])

        const calls = await getCalls(videoId)
        expect(calls).to.have.lengthOf(3)
        expect(calls[2]).to.deep.equal({ trigger: 'new-file', currentTags: [ triggerTag ] })
      })

      it('Should run auto taggers with the rebuild trigger when the instance watched words change', async function () {
        await server.watchedWordsLists.createList({ listName: 'trigger list', words: [ 'not in the video' ] })
        await waitJobs([ server ])

        const calls = await getCalls(videoId)
        expect(calls).to.have.lengthOf(4)
        expect(calls[3]).to.deep.equal({ trigger: 'rebuild', currentTags: [ triggerTag ] })

        expect(await getAutomaticTags(videoUUID)).to.have.members([ triggerTag ])
      })

      it('Should run auto taggers with the new-file trigger after a studio edition', async function () {
        this.timeout(120000)

        await server.config.enableMinimumTranscoding()
        await server.config.enableStudio()

        await server.videoStudio.createEditionTasks({ videoId: videoUUID, tasks: [ { name: 'cut', options: { start: 1 } } ] })
        await waitJobs([ server ])

        const calls = await getCalls(videoId)
        expect(calls).to.have.lengthOf(5)
        expect(calls[4]).to.deep.equal({ trigger: 'new-file', currentTags: [ triggerTag ] })
      })
    })

    describe('Remote video', function () {
      let videoId: number
      let videoUUID: string

      it('Should run auto taggers with the new-video trigger on remote video creation', async function () {
        this.timeout(60000)
        ;({ uuid: videoUUID } = await anotherServer.videos.quickUpload({ name: 'remote record-trigger' }))
        await waitJobs([ server, anotherServer ])
        ;({ id: videoId } = await server.videos.get({ id: videoUUID }))

        expect(await getCalls(videoId)).to.deep.equal([ { trigger: 'new-video', currentTags: [] } ])
        expect(await getAutomaticTags(videoUUID)).to.have.members([ triggerTag ])
      })

      it('Should not run auto taggers on a remote update that does not change the name, the description or the file', async function () {
        await anotherServer.videos.update({ id: videoUUID, attributes: { support: 'new support' } })
        await waitJobs([ server, anotherServer ])

        expect(await getCalls(videoId)).to.have.lengthOf(1)
      })

      it('Should run auto taggers with the metadata trigger on remote name update', async function () {
        await anotherServer.videos.update({ id: videoUUID, attributes: { name: 'remote record-trigger updated' } })
        await waitJobs([ server, anotherServer ])

        const calls = await getCalls(videoId)
        expect(calls).to.have.lengthOf(2)
        expect(calls[1]).to.deep.equal({ trigger: 'metadata', currentTags: [ triggerTag ] })
      })

      it('Should run auto taggers with the new-file trigger on remote source replacement', async function () {
        this.timeout(120000)

        await anotherServer.videos.replaceSourceFile({ videoId: videoUUID, fixture: 'video_short.webm' })
        await waitJobs([ server, anotherServer ])

        const calls = await getCalls(videoId)
        expect(calls).to.have.lengthOf(3)
        expect(calls[2]).to.deep.equal({ trigger: 'new-file', currentTags: [ triggerTag ] })
      })
    })

    describe('Live video', function () {
      before(async function () {
        await server.config.enableMinimumTranscoding()
        await server.config.enableLive({ allowReplay: true, transcoding: false })

        await anotherServer.config.enableMinimumTranscoding()
        await anotherServer.config.enableLive({ allowReplay: true, transcoding: false })
      })

      function createLive (options: {
        liveServer: PeerTubeServer
        name: string
        permanentLive: boolean
      }) {
        const { liveServer, name, permanentLive } = options

        return liveServer.live.create({
          fields: {
            name,
            permanentLive,
            saveReplay: true,
            replaySettings: { privacy: VideoPrivacy.PUBLIC },
            privacy: VideoPrivacy.PUBLIC
          }
        })
      }

      async function streamAndStop (options: {
        streamServer: PeerTubeServer
        videoUUID: string
        permanentLive: boolean
      }) {
        const { streamServer, videoUUID, permanentLive } = options

        const ffmpegCommand = await streamServer.live.sendRTMPStreamInVideo({ videoId: videoUUID })
        await waitUntilLivePublishedOnAllServers([ server, anotherServer ], videoUUID)
        await waitJobs([ server, anotherServer ])

        await stopFfmpeg(ffmpegCommand)

        if (permanentLive) await waitUntilLiveWaitingOnAllServers([ server, anotherServer ], videoUUID)
        else await waitUntilLiveReplacedByReplayOnAllServers([ server, anotherServer ], videoUUID)

        await waitJobs([ server, anotherServer ])
      }

      it('Should run auto taggers with the new-file trigger when a local live is replaced by its replay', async function () {
        this.timeout(240000)

        const { id: videoId, uuid: videoUUID } = await createLive({
          liveServer: server,
          name: 'local live record-trigger',
          permanentLive: false
        })
        await waitJobs([ server, anotherServer ])

        expect(await getCalls(videoId)).to.deep.equal([ { trigger: 'new-video', currentTags: [] } ])

        await streamAndStop({ streamServer: server, videoUUID, permanentLive: false })

        const calls = await getCalls(videoId)
        expect(calls).to.have.lengthOf(2)
        expect(calls[1]).to.deep.equal({ trigger: 'new-file', currentTags: [ triggerTag ] })
      })

      it('Should run auto taggers with the new-video trigger on the replay of a local permanent live', async function () {
        this.timeout(240000)

        const { uuid: videoUUID } = await createLive({
          liveServer: server,
          name: 'local permanent live record-trigger',
          permanentLive: true
        })
        await waitJobs([ server, anotherServer ])

        await streamAndStop({ streamServer: server, videoUUID, permanentLive: true })

        const replay = await findExternalSavedVideo(server, videoUUID)
        expect(replay).to.exist

        expect(await getCalls(replay.id)).to.deep.equal([ { trigger: 'new-video', currentTags: [] } ])
        expect(await getAutomaticTags(replay.uuid)).to.have.members([ triggerTag ])
      })

      it('Should run auto taggers with the new-file trigger when a remote live is replaced by its replay', async function () {
        this.timeout(240000)

        const { uuid: videoUUID } = await createLive({
          liveServer: anotherServer,
          name: 'remote live record-trigger',
          permanentLive: false
        })
        await waitJobs([ server, anotherServer ])

        const { id: videoId } = await server.videos.get({ id: videoUUID })
        expect(await getCalls(videoId)).to.deep.equal([ { trigger: 'new-video', currentTags: [] } ])

        await streamAndStop({ streamServer: anotherServer, videoUUID, permanentLive: false })

        const calls = await getCalls(videoId)
        expect(calls).to.have.lengthOf(2)
        expect(calls[1]).to.deep.equal({ trigger: 'new-file', currentTags: [ triggerTag ] })
      })
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

      await waitJobs([ server ])

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

      await waitJobs([ server ])

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
