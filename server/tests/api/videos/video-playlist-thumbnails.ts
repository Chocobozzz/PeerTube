/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { testImageGeneratedByFFmpeg } from '@server/tests/shared'
import { VideoPlaylistPrivacy } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'

describe('Playlist thumbnail', function () {
  let servers: PeerTubeServer[] = []

  let playlistWithoutThumbnailId: number
  let playlistWithThumbnailId: number

  let withThumbnailE1: number
  let withThumbnailE2: number
  let withoutThumbnailE1: number
  let withoutThumbnailE2: number

  let video1: number
  let video2: number

  async function getPlaylistWithoutThumbnail (server: PeerTubeServer) {
    const body = await server.playlists.list({ start: 0, count: 10 })

    return body.data.find(p => p.displayName === 'playlist without thumbnail')
  }

  async function getPlaylistWithThumbnail (server: PeerTubeServer) {
    const body = await server.playlists.list({ start: 0, count: 10 })

    return body.data.find(p => p.displayName === 'playlist with thumbnail')
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    for (const server of servers) {
      await server.config.disableTranscoding()
    }

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    video1 = (await servers[0].videos.quickUpload({ name: 'video 1' })).id
    video2 = (await servers[0].videos.quickUpload({ name: 'video 2' })).id

    await waitJobs(servers)
  })

  it('Should automatically update the thumbnail when adding an element', async function () {
    this.timeout(30000)

    const created = await servers[1].playlists.create({
      attributes: {
        displayName: 'playlist without thumbnail',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[1].store.channel.id
      }
    })
    playlistWithoutThumbnailId = created.id

    const added = await servers[1].playlists.addElement({
      playlistId: playlistWithoutThumbnailId,
      attributes: { videoId: video1 }
    })
    withoutThumbnailE1 = added.id

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithoutThumbnail(server)
      await testImageGeneratedByFFmpeg(server.url, 'thumbnail-playlist', p.thumbnailPath)
    }
  })

  it('Should not update the thumbnail if we explicitly uploaded a thumbnail', async function () {
    this.timeout(30000)

    const created = await servers[1].playlists.create({
      attributes: {
        displayName: 'playlist with thumbnail',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[1].store.channel.id,
        thumbnailfile: 'custom-thumbnail.jpg'
      }
    })
    playlistWithThumbnailId = created.id

    const added = await servers[1].playlists.addElement({
      playlistId: playlistWithThumbnailId,
      attributes: { videoId: video1 }
    })
    withThumbnailE1 = added.id

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithThumbnail(server)
      await testImageGeneratedByFFmpeg(server.url, 'custom-thumbnail', p.thumbnailPath)
    }
  })

  it('Should automatically update the thumbnail when moving the first element', async function () {
    this.timeout(30000)

    const added = await servers[1].playlists.addElement({
      playlistId: playlistWithoutThumbnailId,
      attributes: { videoId: video2 }
    })
    withoutThumbnailE2 = added.id

    await servers[1].playlists.reorderElements({
      playlistId: playlistWithoutThumbnailId,
      attributes: {
        startPosition: 1,
        insertAfterPosition: 2
      }
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithoutThumbnail(server)
      await testImageGeneratedByFFmpeg(server.url, 'thumbnail-playlist', p.thumbnailPath)
    }
  })

  it('Should not update the thumbnail when moving the first element if we explicitly uploaded a thumbnail', async function () {
    this.timeout(30000)

    const added = await servers[1].playlists.addElement({
      playlistId: playlistWithThumbnailId,
      attributes: { videoId: video2 }
    })
    withThumbnailE2 = added.id

    await servers[1].playlists.reorderElements({
      playlistId: playlistWithThumbnailId,
      attributes: {
        startPosition: 1,
        insertAfterPosition: 2
      }
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithThumbnail(server)
      await testImageGeneratedByFFmpeg(server.url, 'custom-thumbnail', p.thumbnailPath)
    }
  })

  it('Should automatically update the thumbnail when deleting the first element', async function () {
    this.timeout(30000)

    await servers[1].playlists.removeElement({
      playlistId: playlistWithoutThumbnailId,
      elementId: withoutThumbnailE1
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithoutThumbnail(server)
      await testImageGeneratedByFFmpeg(server.url, 'thumbnail-playlist', p.thumbnailPath)
    }
  })

  it('Should not update the thumbnail when deleting the first element if we explicitly uploaded a thumbnail', async function () {
    this.timeout(30000)

    await servers[1].playlists.removeElement({
      playlistId: playlistWithThumbnailId,
      elementId: withThumbnailE1
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithThumbnail(server)
      await testImageGeneratedByFFmpeg(server.url, 'custom-thumbnail', p.thumbnailPath)
    }
  })

  it('Should the thumbnail when we delete the last element', async function () {
    this.timeout(30000)

    await servers[1].playlists.removeElement({
      playlistId: playlistWithoutThumbnailId,
      elementId: withoutThumbnailE2
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithoutThumbnail(server)
      expect(p.thumbnailPath).to.be.null
    }
  })

  it('Should not update the thumbnail when we delete the last element if we explicitly uploaded a thumbnail', async function () {
    this.timeout(30000)

    await servers[1].playlists.removeElement({
      playlistId: playlistWithThumbnailId,
      elementId: withThumbnailE2
    })

    await waitJobs(servers)

    for (const server of servers) {
      const p = await getPlaylistWithThumbnail(server)
      await testImageGeneratedByFFmpeg(server.url, 'custom-thumbnail', p.thumbnailPath)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
