import 'mocha'
import { expect } from 'chai'
import { FIXTURE_URLS } from '@server/tests/shared'
import { areHttpImportTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, VideoChannelSyncState, VideoInclude, VideoPrivacy } from '@shared/models'
import {
  ChannelSyncsCommand,
  createSingleServer,
  getServerImportConfig,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'

describe('Test channel synchronizations', function () {
  if (areHttpImportTestsDisabled()) return

  function runSuite (mode: 'youtube-dl' | 'yt-dlp') {

    describe('Sync using ' + mode, function () {
      let server: PeerTubeServer
      let command: ChannelSyncsCommand

      let startTestDate: Date

      let rootChannelSyncId: number
      const userInfo = {
        accessToken: '',
        username: 'user1',
        channelName: 'user1_channel',
        channelId: -1,
        syncId: -1
      }

      async function changeDateForSync (channelSyncId: number, newDate: string) {
        await server.sql.updateQuery(
          `UPDATE "videoChannelSync" ` +
          `SET "createdAt"='${newDate}', "lastSyncAt"='${newDate}' ` +
          `WHERE id=${channelSyncId}`
        )
      }

      before(async function () {
        this.timeout(120_000)

        startTestDate = new Date()

        server = await createSingleServer(1, getServerImportConfig(mode))

        await setAccessTokensToServers([ server ])
        await setDefaultVideoChannel([ server ])
        await setDefaultChannelAvatar([ server ])
        await setDefaultAccountAvatar([ server ])

        await server.config.enableChannelSync()

        command = server.channelSyncs

        {
          userInfo.accessToken = await server.users.generateUserAndToken(userInfo.username)

          const { videoChannels } = await server.users.getMyInfo({ token: userInfo.accessToken })
          userInfo.channelId = videoChannels[0].id
        }
      })

      it('Should fetch the latest channel videos of a remote channel', async function () {
        this.timeout(120_000)

        {
          const { video } = await server.imports.importVideo({
            attributes: {
              channelId: server.store.channel.id,
              privacy: VideoPrivacy.PUBLIC,
              targetUrl: FIXTURE_URLS.youtube
            }
          })

          expect(video.name).to.equal('small video - youtube')

          const { total } = await server.videos.listByChannel({ handle: 'root_channel', include: VideoInclude.NOT_PUBLISHED_STATE })
          expect(total).to.equal(1)
        }

        const { videoChannelSync } = await command.create({
          attributes: {
            externalChannelUrl: FIXTURE_URLS.youtubeChannel,
            videoChannelId: server.store.channel.id
          },
          token: server.accessToken,
          expectedStatus: HttpStatusCode.OK_200
        })
        rootChannelSyncId = videoChannelSync.id

        // Ensure any missing video not already fetched will be considered as new
        await changeDateForSync(videoChannelSync.id, '1970-01-01')

        await server.debug.sendCommand({
          body: {
            command: 'process-video-channel-sync-latest'
          }
        })

        {
          await waitJobs(server)

          const { total, data } = await server.videos.listByChannel({ handle: 'root_channel', include: VideoInclude.NOT_PUBLISHED_STATE })
          expect(total).to.equal(2)
          expect(data[0].name).to.equal('test')
        }
      })

      it('Should add another synchronization', async function () {
        const externalChannelUrl = FIXTURE_URLS.youtubeChannel + '?foo=bar'

        const { videoChannelSync } = await command.create({
          attributes: {
            externalChannelUrl,
            videoChannelId: server.store.channel.id
          },
          token: server.accessToken,
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(videoChannelSync.externalChannelUrl).to.equal(externalChannelUrl)
        expect(videoChannelSync.channel).to.include({
          id: server.store.channel.id,
          name: 'root_channel'
        })
        expect(videoChannelSync.state.id).to.equal(VideoChannelSyncState.WAITING_FIRST_RUN)
        expect(new Date(videoChannelSync.createdAt)).to.be.above(startTestDate).and.to.be.at.most(new Date())
      })

      it('Should add a synchronization for another user', async function () {
        const { videoChannelSync } = await command.create({
          attributes: {
            externalChannelUrl: FIXTURE_URLS.youtubeChannel + '?baz=qux',
            videoChannelId: userInfo.channelId
          },
          token: userInfo.accessToken
        })
        userInfo.syncId = videoChannelSync.id
      })

      it('Should not import a channel if not asked', async function () {
        await waitJobs(server)

        const { data } = await command.listByAccount({ accountName: userInfo.username })

        expect(data[0].state).to.contain({
          id: VideoChannelSyncState.WAITING_FIRST_RUN,
          label: 'Waiting first run'
        })
      })

      it('Should only fetch the videos newer than the creation date', async function () {
        this.timeout(120_000)

        await changeDateForSync(userInfo.syncId, '2019-03-01')

        await server.debug.sendCommand({
          body: {
            command: 'process-video-channel-sync-latest'
          }
        })

        await waitJobs(server)

        const { data, total } = await server.videos.listByChannel({
          handle: userInfo.channelName,
          include: VideoInclude.NOT_PUBLISHED_STATE
        })

        expect(total).to.equal(1)
        expect(data[0].name).to.equal('test')
      })

      it('Should list channel synchronizations', async function () {
        // Root
        {
          const { total, data } = await command.listByAccount({ accountName: 'root' })
          expect(total).to.equal(2)

          expect(data[0]).to.deep.contain({
            externalChannelUrl: FIXTURE_URLS.youtubeChannel,
            state: {
              id: VideoChannelSyncState.SYNCED,
              label: 'Synchronized'
            }
          })

          expect(new Date(data[0].lastSyncAt)).to.be.greaterThan(startTestDate)

          expect(data[0].channel).to.contain({ id: server.store.channel.id })
          expect(data[1]).to.contain({ externalChannelUrl: FIXTURE_URLS.youtubeChannel + '?foo=bar' })
        }

        // User
        {
          const { total, data } = await command.listByAccount({ accountName: userInfo.username })
          expect(total).to.equal(1)
          expect(data[0]).to.deep.contain({
            externalChannelUrl: FIXTURE_URLS.youtubeChannel + '?baz=qux',
            state: {
              id: VideoChannelSyncState.SYNCED,
              label: 'Synchronized'
            }
          })
        }
      })

      it('Should list imports of a channel synchronization', async function () {
        const { total, data } = await server.imports.getMyVideoImports({ videoChannelSyncId: rootChannelSyncId })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
        expect(data[0].video.name).to.equal('test')
      })

      it('Should remove user\'s channel synchronizations', async function () {
        await command.delete({ channelSyncId: userInfo.syncId })

        const { total } = await command.listByAccount({ accountName: userInfo.username })
        expect(total).to.equal(0)
      })

      after(async function () {
        await server?.kill()
      })
    })
  }

  runSuite('youtube-dl')
  runSuite('yt-dlp')
})
