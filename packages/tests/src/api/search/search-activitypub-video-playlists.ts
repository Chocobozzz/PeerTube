/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { VideoPlaylistPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  PeerTubeServer,
  SearchCommand,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test ActivityPub playlists search', function () {
  let servers: PeerTubeServer[]
  let playlistServer1UUID: string
  let playlistServer2UUID: string
  let video2Server2: string

  let command: SearchCommand

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    {
      const video1 = (await servers[0].videos.quickUpload({ name: 'video 1' })).uuid
      const video2 = (await servers[0].videos.quickUpload({ name: 'video 2' })).uuid

      const attributes = {
        displayName: 'playlist 1 on server 1',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[0].store.channel.id
      }
      const created = await servers[0].playlists.create({ attributes })
      playlistServer1UUID = created.uuid

      for (const videoId of [ video1, video2 ]) {
        await servers[0].playlists.addElement({ playlistId: playlistServer1UUID, attributes: { videoId } })
      }
    }

    {
      const videoId = (await servers[1].videos.quickUpload({ name: 'video 1' })).uuid
      video2Server2 = (await servers[1].videos.quickUpload({ name: 'video 2' })).uuid

      const attributes = {
        displayName: 'playlist 1 on server 2',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[1].store.channel.id
      }
      const created = await servers[1].playlists.create({ attributes })
      playlistServer2UUID = created.uuid

      await servers[1].playlists.addElement({ playlistId: playlistServer2UUID, attributes: { videoId } })
    }

    await waitJobs(servers)

    command = servers[0].search
  })

  it('Should not find a remote playlist', async function () {
    {
      const search = servers[1].url + '/video-playlists/43'
      const body = await command.searchPlaylists({ search, token: servers[0].accessToken })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }

    {
      // Without token
      const search = servers[1].url + '/video-playlists/' + playlistServer2UUID
      const body = await command.searchPlaylists({ search })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }
  })

  it('Should search a local playlist', async function () {
    const search = servers[0].url + '/video-playlists/' + playlistServer1UUID
    const body = await command.searchPlaylists({ search })

    expect(body.total).to.equal(1)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(1)
    expect(body.data[0].displayName).to.equal('playlist 1 on server 1')
    expect(body.data[0].videosLength).to.equal(2)
  })

  it('Should search a local playlist with an alternative URL', async function () {
    const searches = [
      servers[0].url + '/videos/watch/playlist/' + playlistServer1UUID,
      servers[0].url + '/w/p/' + playlistServer1UUID
    ]

    for (const search of searches) {
      for (const token of [ undefined, servers[0].accessToken ]) {
        const body = await command.searchPlaylists({ search, token })

        expect(body.total).to.equal(1)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(1)
        expect(body.data[0].displayName).to.equal('playlist 1 on server 1')
        expect(body.data[0].videosLength).to.equal(2)
      }
    }
  })

  it('Should search a local playlist with a query in URL', async function () {
    const searches = [
      servers[0].url + '/videos/watch/playlist/' + playlistServer1UUID,
      servers[0].url + '/w/p/' + playlistServer1UUID
    ]

    for (const search of searches) {
      for (const token of [ undefined, servers[0].accessToken ]) {
        const body = await command.searchPlaylists({ search: search + '?param=1', token })

        expect(body.total).to.equal(1)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(1)
        expect(body.data[0].displayName).to.equal('playlist 1 on server 1')
        expect(body.data[0].videosLength).to.equal(2)
      }
    }
  })

  it('Should search a remote playlist', async function () {
    const searches = [
      servers[1].url + '/video-playlists/' + playlistServer2UUID,
      servers[1].url + '/videos/watch/playlist/' + playlistServer2UUID,
      servers[1].url + '/w/p/' + playlistServer2UUID
    ]

    for (const search of searches) {
      const body = await command.searchPlaylists({ search, token: servers[0].accessToken })

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].displayName).to.equal('playlist 1 on server 2')
      expect(body.data[0].videosLength).to.equal(1)
    }
  })

  it('Should not list this remote playlist', async function () {
    const body = await servers[0].playlists.list({ start: 0, count: 10 })
    expect(body.total).to.equal(1)
    expect(body.data).to.have.lengthOf(1)
    expect(body.data[0].displayName).to.equal('playlist 1 on server 1')
  })

  it('Should update the playlist of server 2, and refresh it on server 1', async function () {
    this.timeout(60000)

    await servers[1].playlists.addElement({ playlistId: playlistServer2UUID, attributes: { videoId: video2Server2 } })

    await waitJobs(servers)
    // Expire playlist
    await wait(10000)

    // Will run refresh async
    const search = servers[1].url + '/video-playlists/' + playlistServer2UUID
    await command.searchPlaylists({ search, token: servers[0].accessToken })

    // Wait refresh
    await wait(5000)

    const body = await command.searchPlaylists({ search, token: servers[0].accessToken })
    expect(body.total).to.equal(1)
    expect(body.data).to.have.lengthOf(1)

    const playlist = body.data[0]
    expect(playlist.videosLength).to.equal(2)
  })

  it('Should delete playlist of server 2, and delete it on server 1', async function () {
    this.timeout(60000)

    await servers[1].playlists.delete({ playlistId: playlistServer2UUID })

    await waitJobs(servers)
    // Expiration
    await wait(10000)

    // Will run refresh async
    const search = servers[1].url + '/video-playlists/' + playlistServer2UUID
    await command.searchPlaylists({ search, token: servers[0].accessToken })

    // Wait refresh
    await wait(5000)

    const body = await command.searchPlaylists({ search, token: servers[0].accessToken })
    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
