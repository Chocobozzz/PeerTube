/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  cleanupTests, closeAllSequelize,
  createVideoPlaylist,
  doubleFollow,
  flushAndRunMultipleServers,
  generateUserAccessToken,
  getVideo,
  getVideoPlaylist,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  setActorField,
  setDefaultVideoChannel,
  setPlaylistField,
  setVideoField,
  uploadVideo,
  uploadVideoAndGetId,
  wait,
  waitJobs
} from '../../../../shared/extra-utils'
import { getAccount } from '../../../../shared/extra-utils/users/accounts'
import { VideoPlaylistPrivacy } from '../../../../shared/models/videos'

describe('Test AP refresher', function () {
  let servers: ServerInfo[] = []
  let videoUUID1: string
  let videoUUID2: string
  let videoUUID3: string
  let playlistUUID1: string
  let playlistUUID2: string

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2, { transcoding: { enabled: false } })

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    {
      videoUUID1 = (await uploadVideoAndGetId({ server: servers[1], videoName: 'video1' })).uuid
      videoUUID2 = (await uploadVideoAndGetId({ server: servers[1], videoName: 'video2' })).uuid
      videoUUID3 = (await uploadVideoAndGetId({ server: servers[1], videoName: 'video3' })).uuid
    }

    {
      const a1 = await generateUserAccessToken(servers[1], 'user1')
      await uploadVideo(servers[1].url, a1, { name: 'video4' })

      const a2 = await generateUserAccessToken(servers[1], 'user2')
      await uploadVideo(servers[1].url, a2, { name: 'video5' })
    }

    {
      const playlistAttrs = { displayName: 'playlist1', privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: servers[1].videoChannel.id }
      const res = await createVideoPlaylist({ url: servers[1].url, token: servers[1].accessToken, playlistAttrs })
      playlistUUID1 = res.body.videoPlaylist.uuid
    }

    {
      const playlistAttrs = { displayName: 'playlist2', privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: servers[1].videoChannel.id }
      const res = await createVideoPlaylist({ url: servers[1].url, token: servers[1].accessToken, playlistAttrs })
      playlistUUID2 = res.body.videoPlaylist.uuid
    }

    await doubleFollow(servers[0], servers[1])
  })

  describe('Videos refresher', function () {

    it('Should remove a deleted remote video', async function () {
      this.timeout(60000)

      await wait(10000)

      // Change UUID so the remote server returns a 404
      await setVideoField(servers[1].internalServerNumber, videoUUID1, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b174f')

      await getVideo(servers[0].url, videoUUID1)
      await getVideo(servers[0].url, videoUUID2)

      await waitJobs(servers)

      await getVideo(servers[0].url, videoUUID1, 404)
      await getVideo(servers[0].url, videoUUID2, 200)
    })

    it('Should not update a remote video if the remote instance is down', async function () {
      this.timeout(70000)

      killallServers([ servers[1] ])

      await setVideoField(servers[1].internalServerNumber, videoUUID3, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b174e')

      // Video will need a refresh
      await wait(10000)

      await getVideo(servers[0].url, videoUUID3)
      // The refresh should fail
      await waitJobs([ servers[0] ])

      await reRunServer(servers[1])

      await getVideo(servers[0].url, videoUUID3, 200)
    })
  })

  describe('Actors refresher', function () {

    it('Should remove a deleted actor', async function () {
      this.timeout(60000)

      await wait(10000)

      // Change actor name so the remote server returns a 404
      const to = 'http://localhost:' + servers[1].port + '/accounts/user2'
      await setActorField(servers[1].internalServerNumber, to, 'preferredUsername', 'toto')

      await getAccount(servers[0].url, 'user1@localhost:' + servers[1].port)
      await getAccount(servers[0].url, 'user2@localhost:' + servers[1].port)

      await waitJobs(servers)

      await getAccount(servers[0].url, 'user1@localhost:' + servers[1].port, 200)
      await getAccount(servers[0].url, 'user2@localhost:' + servers[1].port, 404)
    })
  })

  describe('Playlist refresher', function () {

    it('Should remove a deleted playlist', async function () {
      this.timeout(60000)

      await wait(10000)

      // Change UUID so the remote server returns a 404
      await setPlaylistField(servers[1].internalServerNumber, playlistUUID2, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b178e')

      await getVideoPlaylist(servers[0].url, playlistUUID1)
      await getVideoPlaylist(servers[0].url, playlistUUID2)

      await waitJobs(servers)

      await getVideoPlaylist(servers[0].url, playlistUUID1, 200)
      await getVideoPlaylist(servers[0].url, playlistUUID2, 404)
    })
  })

  after(async function () {
    this.timeout(10000)

    await cleanupTests(servers)

    await closeAllSequelize(servers)
  })
})
