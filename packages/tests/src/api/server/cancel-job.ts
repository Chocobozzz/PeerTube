/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { Job, JobState, JobType, VideoDetails, VideoPrivacy, VideoStudioTask } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'
import { expect } from 'chai'

async function waitForActiveJob (server: PeerTubeServer, uuid: string, jobType: JobType) {
  let activeJob: Job

  while (!activeJob) {
    activeJob = await findActiveJobByUUID(server, uuid, jobType)
    if (!activeJob) await wait(300)
  }

  return activeJob
}

async function waitForJobCancellation (server: PeerTubeServer, uuid: string, jobType: JobType) {
  let stillActive = true

  while (stillActive) {
    const job = await findActiveJobByUUID(server, uuid, jobType)
    stillActive = !!job

    if (stillActive) await wait(300)
  }
}

async function findActiveJobByUUID (server: PeerTubeServer, uuid: string, jobType: JobType) {
  const { data } = await server.jobs.list({ state: 'active' as JobState, jobType })

  return data.find(j => j.data?.videoUUID === uuid)
}

describe('Test cancelling running jobs', function () {
  let server: PeerTubeServer
  let video: VideoDetails

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    // Enable transcoding with a single concurrent worker so the job stays in "active" long enough for us to cancel it.
    await server.config.enableTranscoding({ resolutions: 'max', hls: true, webVideo: true })
    await server.config.setTranscodingConcurrency(1)
  })

  it('Should cancel a running transcoding job and abort its ffmpeg process', async function () {
    // Upload a video without waiting for transcoding jobs
    const { uuid } = await server.videos.upload({
      attributes: {
        name: 'to cancel',
        privacy: VideoPrivacy.PUBLIC,
        fixture: 'video_high_bitrate_1080p.mp4'
      },
      waitTorrentGeneration: false
    })

    const activeJob = await waitForActiveJob(server, uuid, 'video-transcoding')

    expect(activeJob.canCancel).to.be.true

    await server.jobs.cancel({ jobId: activeJob.id, jobType: 'video-transcoding' })

    await waitForJobCancellation(server, uuid, 'video-transcoding')

    // Make sure no other transcoding job has been re-spawned for this video
    video = await server.videos.get({ id: uuid })

    const playlistFiles = video.streamingPlaylists.flatMap(p => p.files)
    expect(playlistFiles).to.have.lengthOf(0)
  })

  // --------------------------------------------------------------------------
  // Transcription cancel
  // --------------------------------------------------------------------------

  it('Should cancel a running transcription job', async function () {
    await server.config.enableTranscription()

    const { uuid } = await server.videos.upload({
      attributes: {
        name: 'to cancel transcription',
        privacy: VideoPrivacy.PUBLIC,
        fixture: 'video_high_bitrate_1080p.mp4'
      },
      waitTorrentGeneration: false
    })

    const activeJob = await waitForActiveJob(server, uuid, 'video-transcription')

    expect(activeJob.canCancel).to.be.true

    await server.jobs.cancel({ jobId: activeJob.id, jobType: 'video-transcription' })

    await waitForJobCancellation(server, uuid, 'video-transcription')
  })

  // --------------------------------------------------------------------------
  // Storyboard cancel
  // --------------------------------------------------------------------------

  it('Should cancel a running storyboard generation job and abort its ffmpeg process', async function () {
    // Upload a long video so storyboard generation takes enough time
    const { uuid } = await server.videos.upload({
      attributes: {
        name: 'to cancel storyboard',
        privacy: VideoPrivacy.PUBLIC,
        fixture: 'video_very_long_10p.mp4'
      },
      waitTorrentGeneration: false
    })

    const activeJob = await waitForActiveJob(server, uuid, 'generate-video-storyboard')

    expect(activeJob.canCancel).to.be.true

    await server.jobs.cancel({ jobId: activeJob.id, jobType: 'generate-video-storyboard' })

    await waitForJobCancellation(server, uuid, 'generate-video-storyboard')
  })

  // --------------------------------------------------------------------------
  // Studio edition cancel
  // --------------------------------------------------------------------------

  it('Should cancel a running video studio edition job and abort its ffmpeg process', async function () {
    await server.config.disableTranscoding()

    // Upload a video and wait for initial processing
    const { uuid, id } = await server.videos.quickUpload({ name: 'to cancel studio', fixture: 'video_short.webm' })
    await server.config.enableMinimumTranscoding()
    await server.config.enableStudio()

    // Trigger a simple cut task that requires ffmpeg processing
    const tasks: VideoStudioTask[] = [
      {
        name: 'add-intro',
        options: {
          file: 'video_very_long_10p.mp4'
        }
      }
    ]

    await server.videoStudio.createEditionTasks({ videoId: id, tasks })

    const activeJob = await waitForActiveJob(server, uuid, 'video-studio-edition')

    expect(activeJob.canCancel).to.be.true

    await server.jobs.cancel({ jobId: activeJob.id, jobType: 'video-studio-edition' })

    await waitForJobCancellation(server, uuid, 'video-studio-edition')
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
