/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoChapter, VideoCreateResult, VideoPrivacy } from '@peertube/peertube-models'
import { areHttpImportTestsDisabled, areYoutubeImportTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow, PeerTubeServer, setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { expect } from 'chai'

describe('Test video chapters', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])
  })

  describe('Common tests', function () {
    let video: VideoCreateResult

    before(async function () {
      this.timeout(120000)

      video = await servers[0].videos.quickUpload({ name: 'video' })
      await waitJobs(servers)
    })

    it('Should not have chapters', async function () {
      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([])
      }
    })

    it('Should set chaptets', async function () {
      await servers[0].chapters.update({
        videoId: video.uuid,
        chapters: [
          { title: 'chapter 1', timecode: 45 },
          { title: 'chapter 2', timecode: 58 }
        ]
      })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([
          { title: 'chapter 1', timecode: 45 },
          { title: 'chapter 2', timecode: 58 }
        ])
      }
    })

    it('Should add new chapters', async function () {
      await servers[0].chapters.update({
        videoId: video.uuid,
        chapters: [
          { title: 'chapter 1', timecode: 45 },
          { title: 'chapter 2', timecode: 46 },
          { title: 'chapter 3', timecode: 58 }
        ]
      })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([
          { title: 'chapter 1', timecode: 45 },
          { title: 'chapter 2', timecode: 46 },
          { title: 'chapter 3', timecode: 58 }
        ])
      }
    })

    it('Should delete all chapters', async function () {
      await servers[0].chapters.update({ videoId: video.uuid, chapters: [] })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([])
      }
    })
  })

  describe('With chapters in description', function () {
    const description = 'this is a super description\n' +
      '00:00 chapter 1\n' +
      '00:03 chapter 2\n' +
      '00:04 chapter 3\n'

    function checkChapters (chapters: VideoChapter[]) {
      expect(chapters).to.deep.equal([
        {
          timecode: 0,
          title: 'chapter 1'
        },
        {
          timecode: 3,
          title: 'chapter 2'
        },
        {
          timecode: 4,
          title: 'chapter 3'
        }
      ])
    }

    it('Should upload a video with chapters in description', async function () {
      const video = await servers[0].videos.upload({ attributes: { name: 'description', description } })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        checkChapters(chapters)
      }
    })

    it('Should update a video description and automatically add chapters', async function () {
      const video = await servers[0].videos.quickUpload({ name: 'update description' })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([])
      }

      await servers[0].videos.update({ id: video.uuid, attributes: { description } })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        checkChapters(chapters)
      }
    })

    it('Should update a video description but not automatically add chapters since the video already has chapters', async function () {
      const video = await servers[0].videos.quickUpload({ name: 'update description' })

      await servers[0].chapters.update({ videoId: video.uuid, chapters: [ { timecode: 5, title: 'chapter 1' } ] })
      await servers[0].videos.update({ id: video.uuid, attributes: { description } })

      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([ { timecode: 5, title: 'chapter 1' } ])
      }
    })

    it('Should update multiple times chapters from description', async function () {
      const video = await servers[0].videos.quickUpload({ name: 'update description' })

      await servers[0].videos.update({ id: video.uuid, attributes: { description } })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        checkChapters(chapters)
      }

      await servers[0].videos.update({ id: video.uuid, attributes: { description: '00:01 chapter 1\n00:03 chapter 2' } })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([ { timecode: 1, title: 'chapter 1' }, { timecode: 3, title: 'chapter 2' } ])
      }

      await servers[0].videos.update({ id: video.uuid, attributes: { description: 'null description' } })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([])
      }
    })
  })

  describe('With upload', function () {

    it('Should upload a mp4 containing chapters and automatically add them', async function () {
      const video = await servers[0].videos.quickUpload({ fixture: 'video_chapters.mp4', name: 'chapters' })
      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([
          {
            timecode: 0,
            title: 'Chapter 1'
          },
          {
            timecode: 2,
            title: 'Chapter 2'
          },
          {
            timecode: 4,
            title: 'Chapter 3'
          }
        ])
      }
    })
  })

  describe('With URL import', function () {
    if (areHttpImportTestsDisabled()) return

    it('Should detect chapters from youtube URL import', async function () {
      if (areYoutubeImportTestsDisabled()) return

      this.timeout(120000)

      const attributes = {
        channelId: servers[0].store.channel.id,
        privacy: VideoPrivacy.PUBLIC,
        targetUrl: FIXTURE_URLS.youtubeChapters,
        description: 'this is a super description\n'
      }
      const { video } = await servers[0].videoImports.importVideo({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([
          {
            timecode: 0,
            title: 'chapter 1'
          },
          {
            timecode: 15,
            title: 'chapter 2'
          },
          {
            timecode: 35,
            title: 'chapter 3'
          },
          {
            timecode: 40,
            title: 'chapter 4'
          }
        ])
      }
    })

    it('Should have overriden description priority from youtube URL import', async function () {
      if (areYoutubeImportTestsDisabled()) return

      this.timeout(120000)

      const attributes = {
        channelId: servers[0].store.channel.id,
        privacy: VideoPrivacy.PUBLIC,
        targetUrl: FIXTURE_URLS.youtubeChapters,
        description: 'this is a super description\n' +
          '00:00 chapter 1\n' +
          '00:03 chapter 2\n' +
          '00:04 chapter 3\n'
      }
      const { video } = await servers[0].videoImports.importVideo({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([
          {
            timecode: 0,
            title: 'chapter 1'
          },
          {
            timecode: 3,
            title: 'chapter 2'
          },
          {
            timecode: 4,
            title: 'chapter 3'
          }
        ])
      }
    })

    it('Should detect chapters from raw URL import', async function () {
      this.timeout(120000)

      const attributes = {
        channelId: servers[0].store.channel.id,
        privacy: VideoPrivacy.PUBLIC,
        targetUrl: FIXTURE_URLS.chatersVideo
      }
      const { video } = await servers[0].videoImports.importVideo({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { chapters } = await server.chapters.list({ videoId: video.uuid })

        expect(chapters).to.deep.equal([
          {
            timecode: 0,
            title: 'Chapter 1'
          },
          {
            timecode: 2,
            title: 'Chapter 2'
          },
          {
            timecode: 4,
            title: 'Chapter 3'
          }
        ])
      }
    })
  })

  // TODO: test torrent import too

  after(async function () {
    await cleanupTests(servers)
  })
})
