/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, HttpStatusCodeType, VideoStudioTask } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  VideoStudioCommand,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test video studio API validator', function () {
  let server: PeerTubeServer
  let command: VideoStudioCommand
  let userAccessToken: string
  let videoUUID: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    userAccessToken = await server.users.generateUserAndToken('user1')

    await server.config.enableMinimumTranscoding()

    const { uuid } = await server.videos.quickUpload({ name: 'video' })
    videoUUID = uuid

    command = server.videoStudio

    await waitJobs([ server ])
  })

  describe('Task creation', function () {

    describe('Config settings', function () {

      it('Should fail if studio is disabled', async function () {
        await server.config.updateExistingConfig({
          newConfig: {
            videoStudio: {
              enabled: false
            }
          }
        })

        await command.createEditionTasks({
          videoId: videoUUID,
          tasks: VideoStudioCommand.getComplexTask(),
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail to enable studio if transcoding is disabled', async function () {
        await server.config.updateExistingConfig({
          newConfig: {
            videoStudio: {
              enabled: true
            },
            transcoding: {
              enabled: false
            }
          },
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should succeed to enable video studio', async function () {
        await server.config.updateExistingConfig({
          newConfig: {
            videoStudio: {
              enabled: true
            },
            transcoding: {
              enabled: true
            }
          }
        })
      })
    })

    describe('Common tasks', function () {

      it('Should fail without token', async function () {
        await command.createEditionTasks({
          token: null,
          videoId: videoUUID,
          tasks: VideoStudioCommand.getComplexTask(),
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      })

      it('Should fail with another user token', async function () {
        await command.createEditionTasks({
          token: userAccessToken,
          videoId: videoUUID,
          tasks: VideoStudioCommand.getComplexTask(),
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should fail with an invalid video', async function () {
        await command.createEditionTasks({
          videoId: 'tintin',
          tasks: VideoStudioCommand.getComplexTask(),
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail with an unknown video', async function () {
        await command.createEditionTasks({
          videoId: 42,
          tasks: VideoStudioCommand.getComplexTask(),
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })
      })

      it('Should fail with an already in transcoding state video', async function () {
        this.timeout(60000)

        const { uuid } = await server.videos.quickUpload({ name: 'transcoded video' })
        await waitJobs([ server ])

        await server.jobs.pauseJobQueue()
        await server.videos.runTranscoding({ videoId: uuid, transcodingType: 'hls' })

        await command.createEditionTasks({
          videoId: uuid,
          tasks: VideoStudioCommand.getComplexTask(),
          expectedStatus: HttpStatusCode.CONFLICT_409
        })

        await server.jobs.resumeJobQueue()
      })

      it('Should fail with a bad complex task', async function () {
        await command.createEditionTasks({
          videoId: videoUUID,
          tasks: [
            {
              name: 'cut',
              options: {
                start: 1,
                end: 2
              }
            },
            {
              name: 'hadock',
              options: {
                start: 1,
                end: 2
              }
            }
          ] as any,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail without task', async function () {
        await command.createEditionTasks({
          videoId: videoUUID,
          tasks: [],
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail with too many tasks', async function () {
        const tasks: VideoStudioTask[] = []

        for (let i = 0; i < 110; i++) {
          tasks.push({
            name: 'cut',
            options: {
              start: 1
            }
          })
        }

        await command.createEditionTasks({
          videoId: videoUUID,
          tasks,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should succeed with correct parameters', async function () {
        await server.jobs.pauseJobQueue()

        await command.createEditionTasks({
          videoId: videoUUID,
          tasks: VideoStudioCommand.getComplexTask(),
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })
      })

      it('Should fail with a video that is already waiting for edition', async function () {
        this.timeout(360000)

        await command.createEditionTasks({
          videoId: videoUUID,
          tasks: VideoStudioCommand.getComplexTask(),
          expectedStatus: HttpStatusCode.CONFLICT_409
        })

        await server.jobs.resumeJobQueue()

        await waitJobs([ server ])
      })
    })

    describe('Cut task', function () {

      async function cut (start: number, end: number, expectedStatus: HttpStatusCodeType = HttpStatusCode.BAD_REQUEST_400) {
        await command.createEditionTasks({
          videoId: videoUUID,
          tasks: [
            {
              name: 'cut',
              options: {
                start,
                end
              }
            }
          ],
          expectedStatus
        })
      }

      it('Should fail with bad start/end', async function () {
        const invalid = [
          'tintin',
          -1,
          undefined
        ]

        for (const value of invalid) {
          await cut(value as any, undefined)
          await cut(undefined, value as any)
        }
      })

      it('Should fail with the same start/end', async function () {
        await cut(2, 2)
      })

      it('Should fail with inconsistents start/end', async function () {
        await cut(2, 1)
      })

      it('Should fail without start and end', async function () {
        await cut(undefined, undefined)
      })

      it('Should succeed with the correct params', async function () {
        this.timeout(360000)

        await cut(0, 2, HttpStatusCode.NO_CONTENT_204)

        await waitJobs([ server ])
      })
    })

    describe('Watermark task', function () {

      async function addWatermark (file: string, expectedStatus: HttpStatusCodeType = HttpStatusCode.BAD_REQUEST_400) {
        await command.createEditionTasks({
          videoId: videoUUID,
          tasks: [
            {
              name: 'add-watermark',
              options: {
                file
              }
            }
          ],
          expectedStatus
        })
      }

      it('Should fail without waterkmark', async function () {
        await addWatermark(undefined)
      })

      it('Should fail with an invalid watermark', async function () {
        await addWatermark('video_short.mp4')
      })

      it('Should succeed with the correct params', async function () {
        this.timeout(360000)

        await addWatermark('custom-thumbnail.jpg', HttpStatusCode.NO_CONTENT_204)

        await waitJobs([ server ])
      })
    })

    describe('Intro/Outro task', function () {

      async function addIntroOutro (
        type: 'add-intro' | 'add-outro',
        file: string,
        expectedStatus: HttpStatusCodeType = HttpStatusCode.BAD_REQUEST_400
      ) {
        await command.createEditionTasks({
          videoId: videoUUID,
          tasks: [
            {
              name: type,
              options: {
                file
              }
            }
          ],
          expectedStatus
        })
      }

      it('Should fail without file', async function () {
        await addIntroOutro('add-intro', undefined)
        await addIntroOutro('add-outro', undefined)
      })

      it('Should fail with an invalid file', async function () {
        await addIntroOutro('add-intro', 'custom-thumbnail.jpg')
        await addIntroOutro('add-outro', 'custom-thumbnail.jpg')
      })

      it('Should fail with a file that does not contain video stream', async function () {
        await addIntroOutro('add-intro', 'sample.ogg')
        await addIntroOutro('add-outro', 'sample.ogg')

      })

      it('Should succeed with the correct params', async function () {
        this.timeout(360000)

        await addIntroOutro('add-intro', 'video_very_short_240p.mp4', HttpStatusCode.NO_CONTENT_204)
        await waitJobs([ server ])

        await addIntroOutro('add-outro', 'video_very_short_240p.mp4', HttpStatusCode.NO_CONTENT_204)
        await waitJobs([ server ])
      })

      it('Should check total quota when creating the task', async function () {
        this.timeout(360000)

        const user = await server.users.create({ username: 'user_quota_1' })
        const token = await server.login.getAccessToken('user_quota_1')
        const { uuid } = await server.videos.quickUpload({ token, name: 'video_quota_1', fixture: 'video_short.mp4' })

        const addIntroOutroByUser = (type: 'add-intro' | 'add-outro', expectedStatus: HttpStatusCodeType) => {
          return command.createEditionTasks({
            token,
            videoId: uuid,
            tasks: [
              {
                name: type,
                options: {
                  file: 'video_short.mp4'
                }
              }
            ],
            expectedStatus
          })
        }

        await waitJobs([ server ])

        const { videoQuotaUsed } = await server.users.getMyQuotaUsed({ token })
        await server.users.update({ userId: user.id, videoQuota: Math.round(videoQuotaUsed * 2.5) })

        // Still valid
        await addIntroOutroByUser('add-intro', HttpStatusCode.NO_CONTENT_204)

        await waitJobs([ server ])

        // Too much quota
        await addIntroOutroByUser('add-intro', HttpStatusCode.PAYLOAD_TOO_LARGE_413)
        await addIntroOutroByUser('add-outro', HttpStatusCode.PAYLOAD_TOO_LARGE_413)
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
