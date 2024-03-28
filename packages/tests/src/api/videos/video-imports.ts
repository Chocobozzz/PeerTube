/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { CustomConfig, HttpStatusCode, Video, VideoImportState, VideoPrivacy, VideoResolution, VideoState } from '@peertube/peertube-models'
import { areHttpImportTestsDisabled } from '@peertube/peertube-node-utils'
import {
  PeerTubeServer,
  cleanupTests, createMultipleServers,
  createSingleServer,
  doubleFollow,
  getServerImportConfig,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { DeepPartial } from '@peertube/peertube-typescript-utils'
import { testCaptionFile } from '@tests/shared/captions.js'
import { testImageGeneratedByFFmpeg } from '@tests/shared/checks.js'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { expect } from 'chai'
import { pathExists, remove } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import { join } from 'path'

async function checkVideosServer1 (server: PeerTubeServer, idHttp: string, idMagnet: string, idTorrent: string) {
  const videoHttp = await server.videos.get({ id: idHttp })

  expect(videoHttp.name).to.equal('small video - youtube')
  expect(videoHttp.category.label).to.equal('News & Politics')
  expect(videoHttp.licence.label).to.equal('Attribution')
  expect(videoHttp.language.label).to.equal('Unknown')
  expect(videoHttp.nsfw).to.be.false
  expect(videoHttp.description).to.equal('this is a super description')
  expect(videoHttp.tags).to.deep.equal([ 'tag1', 'tag2' ])
  expect(videoHttp.files).to.have.lengthOf(1)

  const originallyPublishedAt = new Date(videoHttp.originallyPublishedAt)
  expect(originallyPublishedAt.getDate()).to.equal(14)
  expect(originallyPublishedAt.getMonth()).to.equal(0)
  expect(originallyPublishedAt.getFullYear()).to.equal(2019)

  const videoMagnet = await server.videos.get({ id: idMagnet })
  const videoTorrent = await server.videos.get({ id: idTorrent })

  for (const video of [ videoMagnet, videoTorrent ]) {
    expect(video.category.label).to.equal('Unknown')
    expect(video.licence.label).to.equal('Unknown')
    expect(video.language.label).to.equal('Unknown')
    expect(video.nsfw).to.be.false
    expect(video.description).to.equal('this is a super torrent description')
    expect(video.tags).to.deep.equal([ 'tag_torrent1', 'tag_torrent2' ])
    expect(video.files).to.have.lengthOf(1)
  }

  expect(videoTorrent.name).to.contain('你好 世界 720p.mp4')
  expect(videoMagnet.name).to.contain('super peertube2 video')

  const bodyCaptions = await server.captions.list({ videoId: idHttp })
  expect(bodyCaptions.total).to.equal(2)
}

async function checkVideoServer2 (server: PeerTubeServer, id: number | string) {
  const video = await server.videos.get({ id })

  expect(video.name).to.equal('my super name')
  expect(video.category.label).to.equal('Entertainment')
  expect(video.licence.label).to.equal('Public Domain Dedication')
  expect(video.language.label).to.equal('English')
  expect(video.nsfw).to.be.false
  expect(video.description).to.equal('my super description')
  expect(video.tags).to.deep.equal([ 'supertag1', 'supertag2' ])

  await testImageGeneratedByFFmpeg(server.url, 'custom-thumbnail', video.thumbnailPath)

  expect(video.files).to.have.lengthOf(1)

  const bodyCaptions = await server.captions.list({ videoId: id })
  expect(bodyCaptions.total).to.equal(2)
}

describe('Test video imports', function () {

  if (areHttpImportTestsDisabled()) return

  function runSuite (mode: 'youtube-dl' | 'yt-dlp') {

    describe('Import ' + mode, function () {
      let servers: PeerTubeServer[] = []

      before(async function () {
        this.timeout(60_000)

        servers = await createMultipleServers(2, getServerImportConfig(mode))

        await setAccessTokensToServers(servers)
        await setDefaultVideoChannel(servers)

        for (const server of servers) {
          await server.config.updateExistingConfig({
            newConfig: {
              transcoding: {
                alwaysTranscodeOriginalResolution: false
              }
            }
          })
        }

        await doubleFollow(servers[0], servers[1])
      })

      it('Should import videos on server 1', async function () {
        this.timeout(60_000)

        const baseAttributes = {
          channelId: servers[0].store.channel.id,
          privacy: VideoPrivacy.PUBLIC
        }

        {
          const attributes = { ...baseAttributes, targetUrl: FIXTURE_URLS.youtube }
          const { video } = await servers[0].videoImports.importVideo({ attributes })
          expect(video.name).to.equal('small video - youtube')

          {
            expect(video.thumbnailPath).to.match(new RegExp(`^/lazy-static/thumbnails/.+.jpg$`))
            expect(video.previewPath).to.match(new RegExp(`^/lazy-static/previews/.+.jpg$`))

            const suffix = mode === 'yt-dlp'
              ? '_yt_dlp'
              : ''

            await testImageGeneratedByFFmpeg(servers[0].url, 'video_import_thumbnail' + suffix, video.thumbnailPath)
            await testImageGeneratedByFFmpeg(servers[0].url, 'video_import_preview' + suffix, video.previewPath)
          }

          const bodyCaptions = await servers[0].captions.list({ videoId: video.id })
          const videoCaptions = bodyCaptions.data
          expect(videoCaptions).to.have.lengthOf(2)

          {
            const enCaption = videoCaptions.find(caption => caption.language.id === 'en')
            expect(enCaption).to.exist
            expect(enCaption.language.label).to.equal('English')
            expect(enCaption.captionPath).to.match(new RegExp(`^/lazy-static/video-captions/.+-en.vtt$`))

            const regex = `WEBVTT[ \n]+Kind: captions[ \n]+` +
              `(Language: en[ \n]+)?` +
              `00:00:01.600 --> 00:00:04.200( position:\\d+% line:\\d+%)?[ \n]+English \\(US\\)[ \n]+` +
              `00:00:05.900 --> 00:00:07.999( position:\\d+% line:\\d+%)?[ \n]+This is a subtitle in American English[ \n]+` +
              `00:00:10.000 --> 00:00:14.000( position:\\d+% line:\\d+%)?[ \n]+Adding subtitles is very easy to do`
            await testCaptionFile(servers[0].url, enCaption.captionPath, new RegExp(regex))
          }

          {
            const frCaption = videoCaptions.find(caption => caption.language.id === 'fr')
            expect(frCaption).to.exist
            expect(frCaption.language.label).to.equal('French')
            expect(frCaption.captionPath).to.match(new RegExp(`^/lazy-static/video-captions/.+-fr.vtt`))

            const regex = `WEBVTT[ \n]+Kind: captions[ \n]+` +
              `(Language: fr[ \n]+)?` +
              `00:00:01.600 --> 00:00:04.200( position:\\d+% line:\\d+%)?[ \n]+Français \\(FR\\)[ \n]+` +
              `00:00:05.900 --> 00:00:07.999( position:\\d+% line:\\d+%)?[ \n]+C'est un sous-titre français[ \n]+` +
              `00:00:10.000 --> 00:00:14.000( position:\\d+% line:\\d+%)?[ \n]+Ajouter un sous-titre est vraiment facile`

            await testCaptionFile(servers[0].url, frCaption.captionPath, new RegExp(regex))
          }
        }

        {
          const attributes = {
            ...baseAttributes,
            magnetUri: FIXTURE_URLS.magnet,
            description: 'this is a super torrent description',
            tags: [ 'tag_torrent1', 'tag_torrent2' ]
          }
          const { video } = await servers[0].videoImports.importVideo({ attributes })
          expect(video.name).to.equal('super peertube2 video')
        }

        {
          const attributes = {
            ...baseAttributes,
            torrentfile: 'video-720p.torrent' as any,
            description: 'this is a super torrent description',
            tags: [ 'tag_torrent1', 'tag_torrent2' ]
          }
          const { video } = await servers[0].videoImports.importVideo({ attributes })
          expect(video.name).to.equal('你好 世界 720p.mp4')
        }
      })

      it('Should list the videos to import in my videos on server 1', async function () {
        const { total, data } = await servers[0].videos.listMyVideos({ sort: 'createdAt' })

        expect(total).to.equal(3)

        expect(data).to.have.lengthOf(3)
        expect(data[0].name).to.equal('small video - youtube')
        expect(data[1].name).to.equal('super peertube2 video')
        expect(data[2].name).to.equal('你好 世界 720p.mp4')
      })

      it('Should list the videos to import in my imports on server 1', async function () {
        const { total, data: videoImports } = await servers[0].videoImports.getMyVideoImports({ sort: '-createdAt' })
        expect(total).to.equal(3)

        expect(videoImports).to.have.lengthOf(3)

        expect(videoImports[2].targetUrl).to.equal(FIXTURE_URLS.youtube)
        expect(videoImports[2].magnetUri).to.be.null
        expect(videoImports[2].torrentName).to.be.null
        expect(videoImports[2].video.name).to.equal('small video - youtube')

        expect(videoImports[1].targetUrl).to.be.null
        expect(videoImports[1].magnetUri).to.equal(FIXTURE_URLS.magnet)
        expect(videoImports[1].torrentName).to.be.null
        expect(videoImports[1].video.name).to.equal('super peertube2 video')

        expect(videoImports[0].targetUrl).to.be.null
        expect(videoImports[0].magnetUri).to.be.null
        expect(videoImports[0].torrentName).to.equal('video-720p.torrent')
        expect(videoImports[0].video.name).to.equal('你好 世界 720p.mp4')
      })

      it('Should filter my imports on target URL', async function () {
        const { total, data: videoImports } = await servers[0].videoImports.getMyVideoImports({ targetUrl: FIXTURE_URLS.youtube })
        expect(total).to.equal(1)
        expect(videoImports).to.have.lengthOf(1)

        expect(videoImports[0].targetUrl).to.equal(FIXTURE_URLS.youtube)
      })

      it('Should search in my imports', async function () {
        {
          const { total, data } = await servers[0].videoImports.getMyVideoImports({ search: 'peertube2' })
          expect(total).to.equal(1)
          expect(data).to.have.lengthOf(1)

          expect(data[0].magnetUri).to.equal(FIXTURE_URLS.magnet)
          expect(data[0].video.name).to.equal('super peertube2 video')
        }

        {
          const { total, data } = await servers[0].videoImports.getMyVideoImports({ search: FIXTURE_URLS.magnet })
          expect(total).to.equal(1)
          expect(data).to.have.lengthOf(1)

          expect(data[0].magnetUri).to.equal(FIXTURE_URLS.magnet)
          expect(data[0].video.name).to.equal('super peertube2 video')
        }
      })

      it('Should have the video listed on the two instances', async function () {
        this.timeout(120_000)

        await waitJobs(servers)

        for (const server of servers) {
          const { total, data } = await server.videos.list()
          expect(total).to.equal(3)
          expect(data).to.have.lengthOf(3)

          const [ videoHttp, videoMagnet, videoTorrent ] = data
          await checkVideosServer1(server, videoHttp.uuid, videoMagnet.uuid, videoTorrent.uuid)
        }
      })

      it('Should import a video on server 2 with some fields', async function () {
        this.timeout(60_000)

        const { video } = await servers[1].videoImports.importVideo({
          attributes: {
            targetUrl: FIXTURE_URLS.youtube,
            channelId: servers[1].store.channel.id,
            privacy: VideoPrivacy.PUBLIC,
            category: 10,
            licence: 7,
            language: 'en',
            name: 'my super name',
            description: 'my super description',
            tags: [ 'supertag1', 'supertag2' ],
            thumbnailfile: 'custom-thumbnail.jpg'
          }
        })
        expect(video.name).to.equal('my super name')
      })

      it('Should have the videos listed on the two instances', async function () {
        this.timeout(120_000)

        await waitJobs(servers)

        for (const server of servers) {
          const { total, data } = await server.videos.list()
          expect(total).to.equal(4)
          expect(data).to.have.lengthOf(4)

          await checkVideoServer2(server, data[0].uuid)

          const [ , videoHttp, videoMagnet, videoTorrent ] = data
          await checkVideosServer1(server, videoHttp.uuid, videoMagnet.uuid, videoTorrent.uuid)
        }
      })

      it('Should import a video that will be transcoded', async function () {
        this.timeout(240_000)

        const attributes = {
          name: 'transcoded video',
          magnetUri: FIXTURE_URLS.magnet,
          channelId: servers[1].store.channel.id,
          privacy: VideoPrivacy.PUBLIC
        }
        const { video } = await servers[1].videoImports.importVideo({ attributes })
        const videoUUID = video.uuid

        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: videoUUID })

          expect(video.name).to.equal('transcoded video')
          expect(video.files).to.have.lengthOf(4)
        }
      })

      it('Should import no HDR version on a HDR video', async function () {
        this.timeout(300_000)

        const config: DeepPartial<CustomConfig> = {
          transcoding: {
            enabled: true,
            resolutions: {
              '0p': false,
              '144p': true,
              '240p': true,
              '360p': false,
              '480p': false,
              '720p': false,
              '1080p': false, // the resulting resolution shouldn't be higher than this, and not vp9.2/av01
              '1440p': false,
              '2160p': false
            },
            webVideos: { enabled: true },
            hls: { enabled: false }
          }
        }
        await servers[0].config.updateExistingConfig({ newConfig: config })

        const attributes = {
          name: 'hdr video',
          targetUrl: FIXTURE_URLS.youtubeHDR,
          channelId: servers[0].store.channel.id,
          privacy: VideoPrivacy.PUBLIC
        }
        const { video: videoImported } = await servers[0].videoImports.importVideo({ attributes })
        const videoUUID = videoImported.uuid

        await waitJobs(servers)

        // test resolution
        const video = await servers[0].videos.get({ id: videoUUID })
        expect(video.name).to.equal('hdr video')
        const maxResolution = Math.max.apply(Math, video.files.map(function (o) { return o.resolution.id }))
        expect(maxResolution, 'expected max resolution not met').to.equals(VideoResolution.H_240P)
      })

      it('Should not import resolution higher than enabled transcoding resolution', async function () {
        this.timeout(300_000)

        const config: DeepPartial<CustomConfig> = {
          transcoding: {
            enabled: true,
            resolutions: {
              '0p': false,
              '144p': true,
              '240p': false,
              '360p': false,
              '480p': false,
              '720p': false,
              '1080p': false,
              '1440p': false,
              '2160p': false
            },
            alwaysTranscodeOriginalResolution: false
          }
        }
        await servers[0].config.updateExistingConfig({ newConfig: config })

        const attributes = {
          name: 'small resolution video',
          targetUrl: FIXTURE_URLS.youtube,
          channelId: servers[0].store.channel.id,
          privacy: VideoPrivacy.PUBLIC
        }
        const { video: videoImported } = await servers[0].videoImports.importVideo({ attributes })
        const videoUUID = videoImported.uuid

        await waitJobs(servers)

        // test resolution
        const video = await servers[0].videos.get({ id: videoUUID })
        expect(video.name).to.equal('small resolution video')
        expect(video.files).to.have.lengthOf(1)
        expect(video.files[0].resolution.id).to.equal(144)
      })

      it('Should import resolution higher than enabled transcoding resolution', async function () {
        this.timeout(300_000)

        const config: DeepPartial<CustomConfig> = {
          transcoding: {
            alwaysTranscodeOriginalResolution: true
          }
        }
        await servers[0].config.updateExistingConfig({ newConfig: config })

        const attributes = {
          name: 'bigger resolution video',
          targetUrl: FIXTURE_URLS.youtube,
          channelId: servers[0].store.channel.id,
          privacy: VideoPrivacy.PUBLIC
        }
        const { video: videoImported } = await servers[0].videoImports.importVideo({ attributes })
        const videoUUID = videoImported.uuid

        await waitJobs(servers)

        // test resolution
        const video = await servers[0].videos.get({ id: videoUUID })
        expect(video.name).to.equal('bigger resolution video')

        expect(video.files).to.have.lengthOf(2)
        expect(video.files.find(f => f.resolution.id === 240)).to.exist
        expect(video.files.find(f => f.resolution.id === 144)).to.exist
      })

      it('Should import a peertube video', async function () {
        this.timeout(120_000)

        const toTest = [ FIXTURE_URLS.peertube_long ]

        // TODO: include peertube_short when https://github.com/ytdl-org/youtube-dl/pull/29475 is merged
        if (mode === 'yt-dlp') {
          toTest.push(FIXTURE_URLS.peertube_short)
        }

        for (const targetUrl of toTest) {
          await servers[0].config.disableTranscoding()

          const attributes = {
            targetUrl,
            channelId: servers[0].store.channel.id,
            privacy: VideoPrivacy.PUBLIC
          }
          const { video } = await servers[0].videoImports.importVideo({ attributes })
          const videoUUID = video.uuid

          await waitJobs(servers)

          for (const server of servers) {
            const video = await server.videos.get({ id: videoUUID })

            expect(video.name).to.equal('E2E tests')

            const { data: captions } = await server.captions.list({ videoId: videoUUID })
            expect(captions).to.have.lengthOf(1)
            expect(captions[0].language.id).to.equal('fr')

            const str = `WEBVTT FILE\r?\n\r?\n` +
            `1\r?\n` +
            `00:00:04.000 --> 00:00:09.000\r?\n` +
            `January 1, 1994. The North American`
            await testCaptionFile(server.url, captions[0].captionPath, new RegExp(str))
          }
        }
      })

      after(async function () {
        await cleanupTests(servers)
      })
    })
  }

  // FIXME: youtube-dl seems broken
  // runSuite('youtube-dl')

  runSuite('yt-dlp')

  describe('Delete/cancel an import', function () {
    let server: PeerTubeServer

    let finishedImportId: number
    let finishedVideo: Video
    let pendingImportId: number

    async function importVideo (name: string) {
      const attributes = { name, channelId: server.store.channel.id, targetUrl: FIXTURE_URLS.goodVideo }
      const res = await server.videoImports.importVideo({ attributes })

      return res.id
    }

    before(async function () {
      this.timeout(120_000)

      server = await createSingleServer(1)

      await setAccessTokensToServers([ server ])
      await setDefaultVideoChannel([ server ])

      finishedImportId = await importVideo('finished')
      await waitJobs([ server ])

      await server.jobs.pauseJobQueue()
      pendingImportId = await importVideo('pending')

      const { data } = await server.videoImports.getMyVideoImports()
      expect(data).to.have.lengthOf(2)

      finishedVideo = data.find(i => i.id === finishedImportId).video
    })

    it('Should delete a video import', async function () {
      await server.videoImports.delete({ importId: finishedImportId })

      const { data } = await server.videoImports.getMyVideoImports()
      expect(data).to.have.lengthOf(1)
      expect(data[0].id).to.equal(pendingImportId)
      expect(data[0].state.id).to.equal(VideoImportState.PENDING)
    })

    it('Should not have deleted the associated video', async function () {
      const video = await server.videos.get({ id: finishedVideo.id, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
      expect(video.name).to.equal('finished')
      expect(video.state.id).to.equal(VideoState.PUBLISHED)
    })

    it('Should cancel a video import', async function () {
      await server.videoImports.cancel({ importId: pendingImportId })

      const { data } = await server.videoImports.getMyVideoImports()
      expect(data).to.have.lengthOf(1)
      expect(data[0].id).to.equal(pendingImportId)
      expect(data[0].state.id).to.equal(VideoImportState.CANCELLED)
    })

    it('Should not have processed the cancelled video import', async function () {
      this.timeout(60_000)

      await server.jobs.resumeJobQueue()

      await waitJobs([ server ])

      const { data } = await server.videoImports.getMyVideoImports()
      expect(data).to.have.lengthOf(1)
      expect(data[0].id).to.equal(pendingImportId)
      expect(data[0].state.id).to.equal(VideoImportState.CANCELLED)
      expect(data[0].video.state.id).to.equal(VideoState.TO_IMPORT)
    })

    it('Should delete the cancelled video import', async function () {
      await server.videoImports.delete({ importId: pendingImportId })
      const { data } = await server.videoImports.getMyVideoImports()
      expect(data).to.have.lengthOf(0)
    })

    after(async function () {
      await cleanupTests([ server ])
    })
  })

  describe('Auto update', function () {
    let server: PeerTubeServer

    function quickPeerTubeImport () {
      const attributes = {
        targetUrl: FIXTURE_URLS.peertube_long,
        channelId: server.store.channel.id,
        privacy: VideoPrivacy.PUBLIC
      }

      return server.videoImports.importVideo({ attributes })
    }

    async function testBinaryUpdate (releaseUrl: string, releaseName: string) {
      await remove(join(server.servers.buildDirectory('bin'), releaseName))

      await server.kill()
      await server.run({
        import: {
          videos: {
            http: {
              youtube_dl_release: {
                url: releaseUrl,
                name: releaseName
              }
            }
          }
        }
      })

      await quickPeerTubeImport()

      const base = server.servers.buildDirectory('bin')
      const content = await readdir(base)
      const binaryPath = join(base, releaseName)

      expect(await pathExists(binaryPath), `${binaryPath} does not exist in ${base} (${content.join(', ')})`).to.be.true
    }

    before(async function () {
      this.timeout(30_000)

      // Run servers
      server = await createSingleServer(1)

      await setAccessTokensToServers([ server ])
      await setDefaultVideoChannel([ server ])
    })

    it('Should update youtube-dl from github URL', async function () {
      this.timeout(120_000)

      await testBinaryUpdate('https://api.github.com/repos/ytdl-org/youtube-dl/releases', 'youtube-dl')
    })

    // FIXME: official instance is broken
    // it('Should update youtube-dl from raw URL', async function () {
    //   this.timeout(120_000)

    //   await testBinaryUpdate('https://yt-dl.org/downloads/latest/youtube-dl', 'youtube-dl')
    // })

    it('Should update youtube-dl from youtube-dl fork', async function () {
      this.timeout(120_000)

      await testBinaryUpdate('https://api.github.com/repos/yt-dlp/yt-dlp/releases', 'yt-dlp')
    })

    after(async function () {
      await cleanupTests([ server ])
    })
  })
})
