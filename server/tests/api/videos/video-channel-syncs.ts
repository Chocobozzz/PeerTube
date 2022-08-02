import { FIXTURE_URLS } from '@server/tests/shared'
import { areHttpImportTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, VideoChannelSyncState, VideoInclude, VideoPrivacy } from '@shared/models'
import {
  ChannelSyncsCommand,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'
import { expect } from 'chai'
import 'mocha'

describe('Test channel synchronizations', function () {
  if (areHttpImportTestsDisabled()) return

  function runSuite (mode: 'youtube-dl' | 'yt-dlp') {
    describe('Sync using ' + mode, function () {
      let server: PeerTubeServer
      let command: ChannelSyncsCommand
      const userInfo = {
        accessToken: '',
        username: 'user1',
        get channelName () {
          return this.username + "_channel"
        },
        channelId: -1,
        syncId: -1
      }

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

        {
          userInfo.username = 'user1'
          const password = 'my super password'
          await server.users.create({ username: userInfo.username, password })
          userInfo.accessToken = await server.login.getAccessToken({ username: userInfo.username, password })

          const { videoChannels } = await server.users.getMyInfo({ token: userInfo.accessToken })
          userInfo.channelId = videoChannels[0].id
        }
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
        await server.debug.sendCommand({
          body: {
            command: 'process-video-channel-sync-latest'
          },
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })

        // then
        {
          const res = await server.videos.listByChannel({ handle: 'root_channel', include: VideoInclude.NOT_PUBLISHED_STATE })
          await waitJobs(server, true)
          expect(res.total).to.equal(2)
          expect(res.data[0].name).to.equal('test')
        }
      })

      it('Should add another synchronizations', async function () {
        await command.create({
          attributes: {
            externalChannelUrl: FIXTURE_URLS.youtubeChannel + "?foo=bar",
            videoChannelId: server.store.channel.id
          },
          token: server.accessToken,
          expectedStatus: HttpStatusCode.OK_200
        })

      })

      it('Should add a synchronization for another user', async function () {
        const { id } = await command.create({
          attributes: {
            externalChannelUrl: FIXTURE_URLS.youtubeChannel + "?baz=qux",
            videoChannelId: userInfo.channelId
          },
          token: userInfo.accessToken,
          expectedStatus: HttpStatusCode.OK_200
        })
        userInfo.syncId = id
      })

      it('Should list user\'s channel synchronizations', async function () {
        const resForRoot = await command.listByAccount({ accountName: 'root' })
        expect(resForRoot.total).to.equal(2)
        expect(resForRoot.data[0]).to.deep.contain({
          externalChannelUrl: FIXTURE_URLS.youtubeChannel,
          state: {
            id: VideoChannelSyncState.SYNCED,
            label: 'Synchronized'
          }
        })
        expect(resForRoot.data[0].channel).to.contain({
          id: server.store.channel.id
        })
        expect(resForRoot.data[1]).to.contain({
          externalChannelUrl: FIXTURE_URLS.youtubeChannel + "?foo=bar"
        })

        const resForUser = await command.listByAccount({ accountName: userInfo.username })
        expect(resForUser.total).to.equal(1)
        expect(resForUser.data[0]).to.deep.contain({
          externalChannelUrl: FIXTURE_URLS.youtubeChannel + "?baz=qux",
          state: {
            id: VideoChannelSyncState.WAITING_FIRST_RUN,
            label: 'Waiting first run'
          }
        })
      })

      it('Should not import a channel if not asked', async function () {
        await waitJobs(server, true)
        const resForUser = await command.listByAccount({ accountName: userInfo.username })
        expect(resForUser.data[0].state).to.contain({
          id: VideoChannelSyncState.WAITING_FIRST_RUN,
          label: 'Waiting first run'
        })
      })

      it('Should import a whole channel (this test takes a while)', async function () {
        this.timeout(240_000)
        await command.syncChannel({
          channelSyncId: userInfo.syncId
        })
        await waitJobs(server, true)
        const resForUser = await server.videos.listByChannel({
          handle: userInfo.channelName
        })
        expect(resForUser.total).to.equal(2)
      })

      it('Should remove user\'s channel synchronizations', async function () {
        await command.delete({ channelSyncId: userInfo.syncId })
        const resForUser = await command.listByAccount({ accountName: userInfo.username })
        expect(resForUser.total).to.equal(0)
      })
    })
  }

  runSuite('youtube-dl')
  runSuite('yt-dlp')
})
