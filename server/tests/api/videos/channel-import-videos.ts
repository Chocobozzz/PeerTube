/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { FIXTURE_URLS } from '@server/tests/shared'
import { areHttpImportTestsDisabled } from '@shared/core-utils'
import {
  createSingleServer,
  getServerImportConfig,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'

describe('Test videos import in a channel', function () {
  if (areHttpImportTestsDisabled()) return

  function runSuite (mode: 'youtube-dl' | 'yt-dlp') {

    describe('Import using ' + mode, function () {
      let server: PeerTubeServer

      before(async function () {
        this.timeout(120_000)

        server = await createSingleServer(1, getServerImportConfig(mode))

        await setAccessTokensToServers([ server ])
        await setDefaultVideoChannel([ server ])

        await server.config.enableChannelSync()
      })

      it('Should import a whole channel without specifying the sync id', async function () {
        this.timeout(240_000)

        await server.channels.importVideos({ channelName: server.store.channel.name, externalChannelUrl: FIXTURE_URLS.youtubeChannel })
        await waitJobs(server)

        const videos = await server.videos.listByChannel({ handle: server.store.channel.name })
        expect(videos.total).to.equal(2)
      })

      it('These imports should not have a sync id', async function () {
        const { total, data } = await server.imports.getMyVideoImports()

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)

        for (const videoImport of data) {
          expect(videoImport.videoChannelSync).to.not.exist
        }
      })

      it('Should import a whole channel and specifying the sync id', async function () {
        this.timeout(240_000)

        {
          server.store.channel.name = 'channel2'
          const { id } = await server.channels.create({ attributes: { name: server.store.channel.name } })
          server.store.channel.id = id
        }

        {
          const attributes = {
            externalChannelUrl: FIXTURE_URLS.youtubeChannel,
            videoChannelId: server.store.channel.id
          }

          const { videoChannelSync } = await server.channelSyncs.create({ attributes })
          server.store.videoChannelSync = videoChannelSync

          await waitJobs(server)
        }

        await server.channels.importVideos({
          channelName: server.store.channel.name,
          externalChannelUrl: FIXTURE_URLS.youtubeChannel,
          videoChannelSyncId: server.store.videoChannelSync.id
        })

        await waitJobs(server)
      })

      it('These imports should have a sync id', async function () {
        const { total, data } = await server.imports.getMyVideoImports()

        expect(total).to.equal(4)
        expect(data).to.have.lengthOf(4)

        const importsWithSyncId = data.filter(i => !!i.videoChannelSync)
        expect(importsWithSyncId).to.have.lengthOf(2)

        for (const videoImport of importsWithSyncId) {
          expect(videoImport.videoChannelSync).to.exist
          expect(videoImport.videoChannelSync.id).to.equal(server.store.videoChannelSync.id)
        }
      })

      it('Should be able to filter imports by this sync id', async function () {
        const { total, data } = await server.imports.getMyVideoImports({ videoChannelSyncId: server.store.videoChannelSync.id })

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)

        for (const videoImport of data) {
          expect(videoImport.videoChannelSync).to.exist
          expect(videoImport.videoChannelSync.id).to.equal(server.store.videoChannelSync.id)
        }
      })

      after(async function () {
        await server?.kill()
      })
    })
  }

  runSuite('yt-dlp')
  runSuite('youtube-dl')
})
