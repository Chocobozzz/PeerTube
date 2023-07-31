/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { SQLCommand } from '@tests/shared/sql-command.js'
import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoPlaylistPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test AP refresher', function () {
  let servers: PeerTubeServer[] = []
  let sqlCommandServer2: SQLCommand
  let videoUUID1: string
  let videoUUID2: string
  let videoUUID3: string
  let playlistUUID1: string
  let playlistUUID2: string

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    for (const server of servers) {
      await server.config.disableTranscoding()
    }

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

    sqlCommandServer2 = new SQLCommand(servers[1])
  })

  describe('Videos refresher', function () {

    it('Should remove a deleted remote video', async function () {
      this.timeout(60000)

      await wait(10000)

      // Change UUID so the remote server returns a 404
      await sqlCommandServer2.setVideoField(videoUUID1, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b174f')

      await servers[0].videos.get({ id: videoUUID1 })
      await servers[0].videos.get({ id: videoUUID2 })

      await waitJobs(servers)

      await servers[0].videos.get({ id: videoUUID1, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await servers[0].videos.get({ id: videoUUID2 })
    })

    it('Should not update a remote video if the remote instance is down', async function () {
      this.timeout(70000)

      await killallServers([ servers[1] ])

      await sqlCommandServer2.setVideoField(videoUUID3, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b174e')

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
      const to = servers[1].url + '/accounts/user2'
      await sqlCommandServer2.setActorField(to, 'preferredUsername', 'toto')

      await command.get({ accountName: 'user1@' + servers[1].host })
      await command.get({ accountName: 'user2@' + servers[1].host })

      await waitJobs(servers)

      await command.get({ accountName: 'user1@' + servers[1].host, expectedStatus: HttpStatusCode.OK_200 })
      await command.get({ accountName: 'user2@' + servers[1].host, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })
  })

  describe('Playlist refresher', function () {

    it('Should remove a deleted playlist', async function () {
      this.timeout(60000)

      await wait(10000)

      // Change UUID so the remote server returns a 404
      await sqlCommandServer2.setPlaylistField(playlistUUID2, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b178e')

      await servers[0].playlists.get({ playlistId: playlistUUID1 })
      await servers[0].playlists.get({ playlistId: playlistUUID2 })

      await waitJobs(servers)

      await servers[0].playlists.get({ playlistId: playlistUUID1, expectedStatus: HttpStatusCode.OK_200 })
      await servers[0].playlists.get({ playlistId: playlistUUID2, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })
  })

  after(async function () {
    await sqlCommandServer2.cleanup()

    await cleanupTests(servers)
  })
})
