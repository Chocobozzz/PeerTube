/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  wait,
  waitJobs
} from '@shared/extra-utils'
import { HttpStatusCode, VideoPlaylistPrivacy } from '@shared/models'

describe('Test AP refresher', function () {
  let servers: PeerTubeServer[] = []
  let videoUUID1: string
  let videoUUID2: string
  let videoUUID3: string
  let playlistUUID1: string
  let playlistUUID2: string

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2, { transcoding: { enabled: false } })

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    {
      videoUUID1 = (await servers[1].videos.quickUpload({ name: 'video1' })).uuid
      videoUUID2 = (await servers[1].videos.quickUpload({ name: 'video2' })).uuid
      videoUUID3 = (await servers[1].videos.quickUpload({ name: 'video3' })).uuid
    }

    {
      const token1 = await servers[1].users.generateUserAndToken('user1')
      await servers[1].videos.upload({ token: token1, attributes: { name: 'video4' } })

      const token2 = await servers[1].users.generateUserAndToken('user2')
      await servers[1].videos.upload({ token: token2, attributes: { name: 'video5' } })
    }

    {
      const attributes = { displayName: 'playlist1', privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: servers[1].store.channel.id }
      const created = await servers[1].playlists.create({ attributes })
      playlistUUID1 = created.uuid
    }

    {
      const attributes = { displayName: 'playlist2', privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: servers[1].store.channel.id }
      const created = await servers[1].playlists.create({ attributes })
      playlistUUID2 = created.uuid
    }

    await doubleFollow(servers[0], servers[1])
  })

  describe('Videos refresher', function () {

    it('Should remove a deleted remote video', async function () {
      this.timeout(60000)

      await wait(10000)

      // Change UUID so the remote server returns a 404
      await servers[1].sql.setVideoField(videoUUID1, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b174f')

      await servers[0].videos.get({ id: videoUUID1 })
      await servers[0].videos.get({ id: videoUUID2 })

      await waitJobs(servers)

      await servers[0].videos.get({ id: videoUUID1, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await servers[0].videos.get({ id: videoUUID2 })
    })

    it('Should not update a remote video if the remote instance is down', async function () {
      this.timeout(70000)

      await killallServers([ servers[1] ])

      await servers[1].sql.setVideoField(videoUUID3, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b174e')

      // Video will need a refresh
      await wait(10000)

      await servers[0].videos.get({ id: videoUUID3 })
      // The refresh should fail
      await waitJobs([ servers[0] ])

      await servers[1].run()

      await servers[0].videos.get({ id: videoUUID3 })
    })
  })

  describe('Actors refresher', function () {

    it('Should remove a deleted actor', async function () {
      this.timeout(60000)

      const command = servers[0].accounts

      await wait(10000)

      // Change actor name so the remote server returns a 404
      const to = 'http://localhost:' + servers[1].port + '/accounts/user2'
      await servers[1].sql.setActorField(to, 'preferredUsername', 'toto')

      await command.get({ accountName: 'user1@localhost:' + servers[1].port })
      await command.get({ accountName: 'user2@localhost:' + servers[1].port })

      await waitJobs(servers)

      await command.get({ accountName: 'user1@localhost:' + servers[1].port, expectedStatus: HttpStatusCode.OK_200 })
      await command.get({ accountName: 'user2@localhost:' + servers[1].port, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })
  })

  describe('Playlist refresher', function () {

    it('Should remove a deleted playlist', async function () {
      this.timeout(60000)

      await wait(10000)

      // Change UUID so the remote server returns a 404
      await servers[1].sql.setPlaylistField(playlistUUID2, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b178e')

      await servers[0].playlists.get({ playlistId: playlistUUID1 })
      await servers[0].playlists.get({ playlistId: playlistUUID2 })

      await waitJobs(servers)

      await servers[0].playlists.get({ playlistId: playlistUUID1, expectedStatus: HttpStatusCode.OK_200 })
      await servers[0].playlists.get({ playlistId: playlistUUID2, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })
  })

  after(async function () {
    this.timeout(10000)

    await cleanupTests(servers)
  })
})
