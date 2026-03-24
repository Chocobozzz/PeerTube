/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoPlaylistPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeActivityPubGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test FEP-1b12', function () {
  let servers: PeerTubeServer[] = []
  let userToken: string
  let videoId: string

  before(async function () {
    servers = await createMultipleServers(2, {}, { env: { FEP_1B12_ONLY: 'true' } })

    await setAccessTokensToServers(servers)

    userToken = await servers[0].users.generateUserAndToken('user')

    await doubleFollow(servers[0], servers[1])
  })

  describe('With FEP-1b12 only enabled', function () {
    it('Should federate videos', async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      videoId = uuid

      await waitJobs(servers)

      {
        const { body } = await makeActivityPubGetRequest(servers[0].url, '/w/' + uuid)
        expect(body.attributedTo).to.be.a('string')
        expect(body.audience).to.exist
      }

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })

        expect(video.channel.name).to.equal('root_channel')
      }
    })

    it('Should update video channels', async function () {
      await servers[0].videos.update({
        id: videoId,
        attributes: { channelId: await servers[0].channels.getDefaultId({ token: userToken }) }
      })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: videoId })

        expect(video.channel.name).to.equal('user_channel')
      }
    })

    it('Should federate playlists', async function () {
      const { uuid } = await servers[0].playlists.create({
        attributes: {
          displayName: 'playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: await servers[0].channels.getDefaultId({ token: userToken })
        }
      })

      await waitJobs(servers)

      {
        const { body } = await makeActivityPubGetRequest(servers[0].url, '/w/p/' + uuid)
        expect(body.attributedTo).to.be.empty
        expect(body.audience).to.exist
      }

      for (const server of servers) {
        const playlist = await server.playlists.get({ playlistId: uuid })

        expect(playlist.videoChannel.name).to.equal('user_channel')
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
