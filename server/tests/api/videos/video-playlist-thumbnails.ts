/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  addVideoInPlaylist,
  cleanupTests,
  createVideoPlaylist,
  doubleFollow,
  flushAndRunMultipleServers,
  getVideoPlaylistsList,
  removeVideoFromPlaylist,
  reorderVideosPlaylist,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  testImage,
  uploadVideoAndGetId,
  waitJobs
} from '../../../../shared/extra-utils'
import { VideoPlaylistPrivacy } from '../../../../shared/models/videos/playlist/video-playlist-privacy.model'

const expect = chai.expect

describe('Playlist thumbnail', function () {
  let servers: ServerInfo[] = []

  let playlistWithoutThumbnail: number
  let playlistWithThumbnail: number

  let withThumbnailE1: number
  let withThumbnailE2: number
  let withoutThumbnailE1: number
  let withoutThumbnailE2: number

  let video1: number
  let video2: number

  async function getPlaylistWithoutThumbnail (server: ServerInfo) {
    const res = await getVideoPlaylistsList(server.url, 0, 10)

    return res.body.data.find(p => p.displayName === 'playlist without thumbnail')
  }

  async function getPlaylistWithThumbnail (server: ServerInfo) {
    const res = await getVideoPlaylistsList(server.url, 0, 10)

    return res.body.data.find(p => p.displayName === 'playlist with thumbnail')
  }

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2, { transcoding: { enabled: false } })

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    video1 = (await uploadVideoAndGetId({ server: servers[0], videoName: 'video 1' })).id
    video2 = (await uploadVideoAndGetId({ server: servers[0], videoName: 'video 2' })).id

    await waitJobs(servers)
  })

  it('Should automatically update the thumbnail when adding an element', async function () {
    this.timeout(30000)

    const res = await createVideoPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistAttrs: {
        displayName: 'playlist without thumbnail',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[1].videoChannel.id
      }
    })
    playlistWithoutThumbnail = res.body.videoPlaylist.id

    const res2 = await addVideoInPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithoutThumbnail,
      elementAttrs: { videoId: video1 }
    })
    withoutThumbnailE1 = res2.body.videoPlaylistElement.id

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithoutThumbnail(server)
      await testImage(server.url, 'thumbnail-playlist', p.thumbnailPath)
    }
  })

  it('Should not update the thumbnail if we explicitly uploaded a thumbnail', async function () {
    this.timeout(30000)

    const res = await createVideoPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistAttrs: {
        displayName: 'playlist with thumbnail',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[1].videoChannel.id,
        thumbnailfile: 'thumbnail.jpg'
      }
    })
    playlistWithThumbnail = res.body.videoPlaylist.id

    const res2 = await addVideoInPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithThumbnail,
      elementAttrs: { videoId: video1 }
    })
    withThumbnailE1 = res2.body.videoPlaylistElement.id

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithThumbnail(server)
      await testImage(server.url, 'thumbnail', p.thumbnailPath)
    }
  })

  it('Should automatically update the thumbnail when moving the first element', async function () {
    this.timeout(30000)

    const res = await addVideoInPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithoutThumbnail,
      elementAttrs: { videoId: video2 }
    })
    withoutThumbnailE2 = res.body.videoPlaylistElement.id

    await reorderVideosPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithoutThumbnail,
      elementAttrs: {
        startPosition: 1,
        insertAfterPosition: 2
      }
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithoutThumbnail(server)
      await testImage(server.url, 'thumbnail-playlist', p.thumbnailPath)
    }
  })

  it('Should not update the thumbnail when moving the first element if we explicitly uploaded a thumbnail', async function () {
    this.timeout(30000)

    const res = await addVideoInPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithThumbnail,
      elementAttrs: { videoId: video2 }
    })
    withThumbnailE2 = res.body.videoPlaylistElement.id

    await reorderVideosPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithThumbnail,
      elementAttrs: {
        startPosition: 1,
        insertAfterPosition: 2
      }
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithThumbnail(server)
      await testImage(server.url, 'thumbnail', p.thumbnailPath)
    }
  })

  it('Should automatically update the thumbnail when deleting the first element', async function () {
    this.timeout(30000)

    await removeVideoFromPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithoutThumbnail,
      playlistElementId: withoutThumbnailE1
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithoutThumbnail(server)
      await testImage(server.url, 'thumbnail-playlist', p.thumbnailPath)
    }
  })

  it('Should not update the thumbnail when deleting the first element if we explicitly uploaded a thumbnail', async function () {
    this.timeout(30000)

    await removeVideoFromPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithThumbnail,
      playlistElementId: withThumbnailE1
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithThumbnail(server)
      await testImage(server.url, 'thumbnail', p.thumbnailPath)
    }
  })

  it('Should the thumbnail when we delete the last element', async function () {
    this.timeout(30000)

    await removeVideoFromPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithoutThumbnail,
      playlistElementId: withoutThumbnailE2
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithoutThumbnail(server)
      expect(p.thumbnailPath).to.be.null
    }
  })

  it('Should not update the thumbnail when we delete the last element if we explicitly uploaded a thumbnail', async function () {
    this.timeout(30000)

    await removeVideoFromPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistId: playlistWithThumbnail,
      playlistElementId: withThumbnailE2
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithThumbnail(server)
      await testImage(server.url, 'thumbnail', p.thumbnailPath)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
