/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  addVideoInPlaylist,
  cleanupTests,
  createVideoPlaylist,
  deleteVideoPlaylist,
  flushAndRunMultipleServers,
  getVideoPlaylistsList,
  searchVideoPlaylists,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  uploadVideoAndGetId,
  wait
} from '../../../../shared/extra-utils'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { VideoPlaylist, VideoPlaylistPrivacy } from '../../../../shared/models/videos'

const expect = chai.expect

describe('Test ActivityPub playlists search', function () {
  let servers: ServerInfo[]
  let playlistServer1UUID: string
  let playlistServer2UUID: string
  let video2Server2: string

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    {
      const video1 = (await uploadVideoAndGetId({ server: servers[0], videoName: 'video 1' })).uuid
      const video2 = (await uploadVideoAndGetId({ server: servers[0], videoName: 'video 2' })).uuid

      const attributes = {
        displayName: 'playlist 1 on server 1',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[0].videoChannel.id
      }
      const res = await createVideoPlaylist({ url: servers[0].url, token: servers[0].accessToken, playlistAttrs: attributes })
      playlistServer1UUID = res.body.videoPlaylist.uuid

      for (const videoId of [ video1, video2 ]) {
        await addVideoInPlaylist({
          url: servers[0].url,
          token: servers[0].accessToken,
          playlistId: playlistServer1UUID,
          elementAttrs: { videoId }
        })
      }
    }

    {
      const videoId = (await uploadVideoAndGetId({ server: servers[1], videoName: 'video 1' })).uuid
      video2Server2 = (await uploadVideoAndGetId({ server: servers[1], videoName: 'video 2' })).uuid

      const attributes = {
        displayName: 'playlist 1 on server 2',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[1].videoChannel.id
      }
      const res = await createVideoPlaylist({ url: servers[1].url, token: servers[1].accessToken, playlistAttrs: attributes })
      playlistServer2UUID = res.body.videoPlaylist.uuid

      await addVideoInPlaylist({
        url: servers[1].url,
        token: servers[1].accessToken,
        playlistId: playlistServer2UUID,
        elementAttrs: { videoId }
      })
    }

    await waitJobs(servers)
  })

  it('Should not find a remote playlist', async function () {
    {
      const search = 'http://localhost:' + servers[1].port + '/video-playlists/43'
      const res = await searchVideoPlaylists(servers[0].url, search, servers[0].accessToken)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(0)
    }

    {
      // Without token
      const search = 'http://localhost:' + servers[1].port + '/video-playlists/' + playlistServer2UUID
      const res = await searchVideoPlaylists(servers[0].url, search)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(0)
    }
  })

  it('Should search a local playlist', async function () {
    const search = 'http://localhost:' + servers[0].port + '/video-playlists/' + playlistServer1UUID
    const res = await searchVideoPlaylists(servers[0].url, search)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].displayName).to.equal('playlist 1 on server 1')
    expect(res.body.data[0].videosLength).to.equal(2)
  })

  it('Should search a local playlist with an alternative URL', async function () {
    const searches = [
      'http://localhost:' + servers[0].port + '/videos/watch/playlist/' + playlistServer1UUID,
      'http://localhost:' + servers[0].port + '/w/p/' + playlistServer1UUID
    ]

    for (const search of searches) {
      for (const token of [ undefined, servers[0].accessToken ]) {
        const res = await searchVideoPlaylists(servers[0].url, search, token)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.be.an('array')
        expect(res.body.data).to.have.lengthOf(1)
        expect(res.body.data[0].displayName).to.equal('playlist 1 on server 1')
        expect(res.body.data[0].videosLength).to.equal(2)
      }
    }
  })

  it('Should search a remote playlist', async function () {
    const searches = [
      'http://localhost:' + servers[1].port + '/video-playlists/' + playlistServer2UUID,
      'http://localhost:' + servers[1].port + '/videos/watch/playlist/' + playlistServer2UUID,
      'http://localhost:' + servers[1].port + '/w/p/' + playlistServer2UUID
    ]

    for (const search of searches) {
      const res = await searchVideoPlaylists(servers[0].url, search, servers[0].accessToken)

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(1)
      expect(res.body.data[0].displayName).to.equal('playlist 1 on server 2')
      expect(res.body.data[0].videosLength).to.equal(1)
    }
  })

  it('Should not list this remote playlist', async function () {
    const res = await getVideoPlaylistsList(servers[0].url, 0, 10)
    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].displayName).to.equal('playlist 1 on server 1')
  })

  it('Should update the playlist of server 2, and refresh it on server 1', async function () {
    this.timeout(60000)

    await addVideoInPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistServer2UUID,
      elementAttrs: { videoId: video2Server2 }
    })

    await waitJobs(servers)
    // Expire playlist
    await wait(10000)

    // Will run refresh async
    const search = 'http://localhost:' + servers[1].port + '/video-playlists/' + playlistServer2UUID
    await searchVideoPlaylists(servers[0].url, search, servers[0].accessToken)

    // Wait refresh
    await wait(5000)

    const res = await searchVideoPlaylists(servers[0].url, search, servers[0].accessToken)
    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)

    const playlist: VideoPlaylist = res.body.data[0]
    expect(playlist.videosLength).to.equal(2)
  })

  it('Should delete playlist of server 2, and delete it on server 1', async function () {
    this.timeout(60000)

    await deleteVideoPlaylist(servers[1].url, servers[1].accessToken, playlistServer2UUID)

    await waitJobs(servers)
    // Expiration
    await wait(10000)

    // Will run refresh async
    const search = 'http://localhost:' + servers[1].port + '/video-playlists/' + playlistServer2UUID
    await searchVideoPlaylists(servers[0].url, search, servers[0].accessToken)

    // Wait refresh
    await wait(5000)

    const res = await searchVideoPlaylists(servers[0].url, search, servers[0].accessToken)
    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
