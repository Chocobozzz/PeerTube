/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoFile } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'

describe('Test video files lifecycle', function () {
  let server: PeerTubeServer
  let sqlCommand: SQLCommand

  // ---------------------------------------------------------------------------

  function buildLifecycleConfig (options: {
    policies: any[]
    dryRun?: boolean
    maxVideosPerRun?: number
  }) {
    return {
      video_file: {
        lifecycle: {
          enabled: true,
          dry_run: options.dryRun ?? false,
          max_videos_per_run: options.maxVideosPerRun ?? 1000,
          policies: options.policies
        }
      }
    }
  }

  function buildPrunePolicy (options: { days?: number, name?: string } = {}) {
    return {
      name: options.name ?? 'prune-files',
      criteria: [ { type: 'views-since', operator: 'lte', count: 0, days: options.days ?? 30 } ],
      action: { type: 'delete-resolutions', keep: 'max' }
    }
  }

  async function restartWithConfig (config: any) {
    await killallServers([ server ])
    await server.run(config)
  }

  async function runLifecycle () {
    await server.debug.sendCommand({ body: { command: 'process-video-files-lifecycle' } })
    await waitJobs([ server ])
  }

  async function listResolutions (uuid: string) {
    // Audio only files are never deleted by the lifecycle, so only list the resolutions that carry a video stream
    const list = (files: VideoFile[]) => {
      return files.filter(f => f.hasVideo)
        .map(f => f.resolution.id)
        .sort((a, b) => a - b)
    }

    const video = await server.videos.getWithToken({ id: uuid })

    return {
      webVideo: list(video.files),
      hls: list(video.streamingPlaylists[0]?.files || [])
    }
  }

  function buildOldDate () {
    return new Date(Date.now() - 400 * 86400000).toISOString()
  }

  // A video published a long time ago, without any view stat
  async function uploadColdVideo (name: string) {
    const { uuid } = await server.videos.quickUpload({ name })
    await waitJobs([ server ])

    await sqlCommand.setVideoField(uuid, 'publishedAt', buildOldDate())

    return uuid
  }

  // ---------------------------------------------------------------------------

  before(async function () {
    this.timeout(240_000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    sqlCommand = new SQLCommand(server)

    await server.config.enableTranscoding({
      hls: true,
      webVideo: true,
      resolutions: [ 240, 480 ],
      splitAudioAndVideo: false
    })
  })

  describe('Delete resolutions action', function () {
    let coldVideoUUID: string
    let maxResolution: number

    before(async function () {
      this.timeout(360_000)

      coldVideoUUID = await uploadColdVideo('cold video')

      const { webVideo, hls } = await listResolutions(coldVideoUUID)

      expect(webVideo).to.have.length.above(1)
      expect(hls).to.have.length.above(1)

      maxResolution = Math.max(...webVideo)
    })

    it('Should not process any video if the lifecycle is disabled', async function () {
      this.timeout(60_000)

      await runLifecycle()

      const { webVideo, hls } = await listResolutions(coldVideoUUID)
      expect(webVideo).to.have.length.above(1)
      expect(hls).to.have.length.above(1)
    })

    it('Should not delete anything in dry run mode', async function () {
      this.timeout(60_000)

      await restartWithConfig(buildLifecycleConfig({ policies: [ buildPrunePolicy() ], dryRun: true }))
      await runLifecycle()

      // The policy matched the video and its job ran: only the deletion itself was skipped
      const { data } = await server.jobs.list({ jobType: 'video-files-lifecycle', count: 100 })
      const jobs = data.filter(j => j.data.videoUUID === coldVideoUUID)

      expect(jobs).to.have.lengthOf(1)
      expect(jobs[0].state).to.equal('completed')

      const { webVideo, hls } = await listResolutions(coldVideoUUID)
      expect(webVideo).to.have.length.above(1)
      expect(hls).to.have.length.above(1)
    })

    it('Should delete resolutions below the max resolution of a video that has not been viewed', async function () {
      this.timeout(60_000)

      await restartWithConfig(buildLifecycleConfig({ policies: [ buildPrunePolicy() ] }))
      await runLifecycle()

      const { webVideo, hls } = await listResolutions(coldVideoUUID)
      expect(webVideo).to.deep.equal([ maxResolution ])
      expect(hls).to.deep.equal([ maxResolution ])
    })

    it('Should still be able to watch the video in its max resolution', async function () {
      const video = await server.videos.getWithToken({ id: coldVideoUUID })

      const videoFiles = video.files.filter(f => f.hasVideo)
      expect(videoFiles).to.have.lengthOf(1)
      expect(video.streamingPlaylists).to.have.lengthOf(1)

      await server.videos.getFileMetadata({ url: videoFiles[0].metadataUrl })
    })

    it('Should not process a video that has already been pruned', async function () {
      this.timeout(60_000)

      // The policy has nothing left to delete on this video, so the scheduler must not select it anymore
      await runLifecycle()

      const { webVideo, hls } = await listResolutions(coldVideoUUID)
      expect(webVideo).to.deep.equal([ maxResolution ])
      expect(hls).to.deep.equal([ maxResolution ])
    })

    it('Should not delete resolutions of a video viewed inside the criterion window', async function () {
      this.timeout(360_000)

      const uuid = await uploadColdVideo('recently viewed video')
      await sqlCommand.createVideoStat({ uuid, views: 3, startDate: new Date().toISOString() })

      await runLifecycle()

      const { webVideo, hls } = await listResolutions(uuid)
      expect(webVideo).to.have.length.above(1)
      expect(hls).to.have.length.above(1)
    })

    it('Should delete resolutions of a video only viewed before the criterion window', async function () {
      this.timeout(360_000)

      const uuid = await uploadColdVideo('formerly viewed video')
      await sqlCommand.createVideoStat({ uuid, views: 50, startDate: buildOldDate() })

      await runLifecycle()

      const { webVideo, hls } = await listResolutions(uuid)
      expect(webVideo).to.have.lengthOf(1)
      expect(hls).to.have.lengthOf(1)
    })

    it('Should count downloads as views', async function () {
      this.timeout(360_000)

      const uuid = await uploadColdVideo('downloaded video')
      await sqlCommand.createVideoStat({ uuid, views: 0, downloads: 5, startDate: new Date().toISOString() })

      await runLifecycle()

      const { webVideo, hls } = await listResolutions(uuid)
      expect(webVideo).to.have.length.above(1)
      expect(hls).to.have.length.above(1)
    })

    it('Should not delete the resolutions of a blacklisted video', async function () {
      this.timeout(360_000)

      const uuid = await uploadColdVideo('blacklisted video')
      await server.blacklist.add({ videoId: uuid })

      await runLifecycle()

      const { webVideo, hls } = await listResolutions(uuid)
      expect(webVideo).to.have.length.above(1)
      expect(hls).to.have.length.above(1)
    })

    it('Should not process more videos than max_videos_per_run', async function () {
      this.timeout(360_000)

      const uuids = [ await uploadColdVideo('budget video 1'), await uploadColdVideo('budget video 2') ]

      await restartWithConfig(buildLifecycleConfig({ policies: [ buildPrunePolicy() ], maxVideosPerRun: 1 }))
      await runLifecycle()

      const results = await Promise.all(uuids.map(uuid => listResolutions(uuid)))
      const pruned = results.filter(r => r.webVideo.length === 1)

      expect(pruned).to.have.lengthOf(1)

      // The remaining video is processed by the next run
      await runLifecycle()

      for (const uuid of uuids) {
        const { webVideo, hls } = await listResolutions(uuid)
        expect(webVideo).to.have.lengthOf(1)
        expect(hls).to.have.lengthOf(1)
      }
    })
  })

  describe('Separated audio and video files', function () {
    let uuid: string

    before(async function () {
      this.timeout(360_000)

      await killallServers([ server ])
      await server.run()

      await server.config.enableTranscoding({ hls: true, webVideo: false, resolutions: [ 240, 480 ], splitAudioAndVideo: true })

      uuid = await uploadColdVideo('split audio video')
    })

    it('Should keep the separated audio file of a HLS playlist', async function () {
      this.timeout(60_000)

      const before = await server.videos.getWithToken({ id: uuid })
      const audioFilesBefore = before.streamingPlaylists[0].files.filter(f => f.hasAudio && !f.hasVideo)
      expect(audioFilesBefore).to.have.lengthOf(1)

      await restartWithConfig(buildLifecycleConfig({ policies: [ buildPrunePolicy() ] }))
      await runLifecycle()

      const after = await server.videos.getWithToken({ id: uuid })
      const files = after.streamingPlaylists[0].files

      const audioFiles = files.filter(f => f.hasAudio && !f.hasVideo)
      const videoFiles = files.filter(f => f.hasVideo)

      expect(audioFiles).to.have.lengthOf(1)
      expect(videoFiles).to.have.lengthOf(1)
      expect(videoFiles[0].resolution.id).to.equal(Math.max(...before.streamingPlaylists[0].files.map(f => f.resolution.id)))
    })
  })

  describe('Views since criterion', function () {
    let popularUUID: string
    let unpopularUUID: string

    before(async function () {
      this.timeout(360_000)

      await killallServers([ server ])
      await server.run()

      await server.config.enableTranscoding({ hls: true, webVideo: true, resolutions: [ 240, 480 ], splitAudioAndVideo: false })

      popularUUID = await uploadColdVideo('popular video')
      unpopularUUID = await uploadColdVideo('unpopular video')

      const startDate = new Date(Date.now() - 5 * 86400000).toISOString()

      await sqlCommand.createVideoStat({ uuid: popularUUID, views: 50, startDate })
      await sqlCommand.createVideoStat({ uuid: unpopularUUID, views: 2, startDate })
    })

    it('Should only prune videos that have less views than the criterion count', async function () {
      this.timeout(60_000)

      const policy = {
        name: 'prune-unpopular-files',
        criteria: [ { type: 'views-since', operator: 'lte', count: 10, days: 30 } ],
        action: { type: 'delete-resolutions', keep: 'max' }
      }

      await restartWithConfig(buildLifecycleConfig({ policies: [ policy ] }))
      await runLifecycle()

      {
        const { webVideo, hls } = await listResolutions(unpopularUUID)
        expect(webVideo).to.have.lengthOf(1)
        expect(hls).to.have.lengthOf(1)
      }

      {
        const { webVideo, hls } = await listResolutions(popularUUID)
        expect(webVideo).to.have.length.above(1)
        expect(hls).to.have.length.above(1)
      }
    })
  })

  describe('First matching policy wins', function () {
    let uuid: string

    before(async function () {
      this.timeout(360_000)

      await killallServers([ server ])
      await server.run()

      await server.config.enableTranscoding({ hls: true, webVideo: true, resolutions: [ 240, 480 ], splitAudioAndVideo: false })

      uuid = await uploadColdVideo('two policies video')
    })

    it('Should only apply the first policy that matches the video', async function () {
      this.timeout(60_000)

      // Both policies match the video, but only the first one must process it
      const policies = [
        buildPrunePolicy({ name: 'first-policy' }),
        buildPrunePolicy({ name: 'second-policy' })
      ]

      await restartWithConfig(buildLifecycleConfig({ policies }))
      await runLifecycle()

      const { data } = await server.jobs.list({ jobType: 'video-files-lifecycle', count: 100 })
      const jobs = data.filter(j => j.data.videoUUID === uuid)

      expect(jobs).to.have.lengthOf(1)
      expect(jobs[0].data.policyName).to.equal('first-policy')

      const { webVideo, hls } = await listResolutions(uuid)
      expect(webVideo).to.have.lengthOf(1)
      expect(hls).to.have.lengthOf(1)
    })
  })

  after(async function () {
    if (sqlCommand) await sqlCommand.cleanup()

    await cleanupTests([ server ])
  })
})
