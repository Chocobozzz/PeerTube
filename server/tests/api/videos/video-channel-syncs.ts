import { FIXTURE_URLS } from '@server/tests/shared'
import { areHttpImportTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, VideoInclude, VideoPrivacy } from '@shared/models'
import {
  ChannelSyncsCommand,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@shared/server-commands'
import { expect } from 'chai'
import 'mocha'

describe('Test channel synchronizations', function () {
  if (areHttpImportTestsDisabled()) return

  function runSuite (mode: 'youtube-dl' | 'yt-dlp') {
    describe('Sync using ' + mode, function () {
      let server: PeerTubeServer
      let command: ChannelSyncsCommand

      before(async function () {
        this.timeout(120_000)
        server = await createSingleServer(1, {
          import: {
            videos: {
              http: {
                youtube_dl_release: {
                  url: mode === 'youtube-dl'
                    ? 'https://yt-dl.org/downloads/latest/youtube-dl'
                    : 'https://api.github.com/repos/yt-dlp/yt-dlp/releases',

                  name: mode
                }
              }
            }
          }
        })
        await setAccessTokensToServers([ server ])
        await setDefaultVideoChannel([ server ])
        command = server.channelSyncs
        await server.config.enableChannelSync()
      })

      after(async function () {
        await server?.kill()
      })

      it('Should fetch the latest channel videos of a remote channel', async function () {
        // given
        this.timeout(120_000)
        const baseAttributes = {
          channelId: server.store.channel.id,
          privacy: VideoPrivacy.PUBLIC
        }

        {
          const attributes = { ...baseAttributes, targetUrl: FIXTURE_URLS.youtube }
          const { video } = await server.imports.importVideo({ attributes })
          expect(video.name).to.equal('small video - youtube')
          const { total: videosCount } = await server.videos.listByChannel({
            handle: 'root_channel',
            include: VideoInclude.NOT_PUBLISHED_STATE
          })
          expect(videosCount).to.equal(1)
        }

        const { id: channelSyncId } = await command.create({
          attributes: {
            externalChannelUrl: FIXTURE_URLS.youtubeChannel,
            videoChannelId: server.store.channel.id
          },
          token: server.accessToken,
          expectedStatus: HttpStatusCode.OK_200
        })

        // Ensure any missing video not already fetched will be considered as new
        await server.sql.updateQuery(`
            UPDATE "videoChannelSync"
            SET "createdAt"='1970-01-01'
            WHERE id=${channelSyncId}
          `)

        // when
        await command.syncChannel({
          channelSyncId,
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })
        await server.debug.sendCommand({
          body: {
            command: 'process-video-channel-sync-latest'
          },
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })

        // then
        {
          const res = await server.videos.listByChannel({ handle: 'root_channel', include: VideoInclude.NOT_PUBLISHED_STATE })
          expect(res.total).to.equal(2)
          expect(res.data[0].name).to.equal('test')
        }
      })
    })

    it('Should list user\'s channel synchronizations', async function () {
      // TODO
    })

    it('Should remove user\'s channel synchronizations', async function () {
      // TODO
    })

    it('Should import a whole channel', async function () {
      // TODO
    })
  }

  runSuite('youtube-dl')
  runSuite('yt-dlp')
})
