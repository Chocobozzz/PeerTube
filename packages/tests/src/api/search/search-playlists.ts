/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { VideoPlaylistPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  doubleFollow,
  PeerTubeServer,
  SearchCommand,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test playlists search', function () {
  let server: PeerTubeServer
  let remoteServer: PeerTubeServer
  let command: SearchCommand
  let playlistUUID: string
  let playlistShortUUID: string

  before(async function () {
    this.timeout(120000)

    const servers = await Promise.all([
      createSingleServer(1),
      createSingleServer(2)
    ])
    server = servers[0]
    remoteServer = servers[1]

    await setAccessTokensToServers([ remoteServer, server ])
    await setDefaultVideoChannel([ remoteServer, server ])
    await setDefaultChannelAvatar([ remoteServer, server ])
    await setDefaultAccountAvatar([ remoteServer, server ])

    await servers[1].config.disableTranscoding()

    {
      const videoId = (await server.videos.upload()).uuid

      const attributes = {
        displayName: 'Dr. Kenzo Tenma hospital videos',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: server.store.channel.id
      }
      const created = await server.playlists.create({ attributes })
      playlistUUID = created.uuid
      playlistShortUUID = created.shortUUID

      await server.playlists.addElement({ playlistId: created.id, attributes: { videoId } })
    }

    {
      const videoId = (await remoteServer.videos.upload()).uuid

      const attributes = {
        displayName: 'Johan & Anna Libert music videos',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: remoteServer.store.channel.id
      }
      const created = await remoteServer.playlists.create({ attributes })

      await remoteServer.playlists.addElement({ playlistId: created.id, attributes: { videoId } })
    }

    {
      const attributes = {
        displayName: 'Inspector Lunge playlist',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: server.store.channel.id
      }
      await server.playlists.create({ attributes })
    }

    await doubleFollow(server, remoteServer)

    command = server.search
  })

  it('Should make a simple search and not have results', async function () {
    const body = await command.searchPlaylists({ search: 'abc' })

    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  it('Should make a search and have results', async function () {
    {
      const search = {
        search: 'tenma',
        start: 0,
        count: 1
      }
      const body = await command.advancedPlaylistSearch({ search })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)

      const playlist = body.data[0]
      expect(playlist.displayName).to.equal('Dr. Kenzo Tenma hospital videos')
      expect(playlist.url).to.equal(server.url + '/video-playlists/' + playlist.uuid)
    }

    {
      const search = {
        search: 'Anna Livert music',
        start: 0,
        count: 1
      }
      const body = await command.advancedPlaylistSearch({ search })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)

      const playlist = body.data[0]
      expect(playlist.displayName).to.equal('Johan & Anna Libert music videos')
    }
  })

  it('Should filter by host', async function () {
    {
      const search = { search: 'tenma', host: server.host }
      const body = await command.advancedPlaylistSearch({ search })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)

      const playlist = body.data[0]
      expect(playlist.displayName).to.equal('Dr. Kenzo Tenma hospital videos')
    }

    {
      const search = { search: 'Anna', host: 'example.com' }
      const body = await command.advancedPlaylistSearch({ search })
      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    }

    {
      const search = { search: 'video', host: remoteServer.host }
      const body = await command.advancedPlaylistSearch({ search })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)

      const playlist = body.data[0]
      expect(playlist.displayName).to.equal('Johan & Anna Libert music videos')
    }
  })

  it('Should filter by UUIDs', async function () {
    for (const uuid of [ playlistUUID, playlistShortUUID ]) {
      const body = await command.advancedPlaylistSearch({ search: { uuids: [ uuid ] } })

      expect(body.total).to.equal(1)
      expect(body.data[0].displayName).to.equal('Dr. Kenzo Tenma hospital videos')
    }

    {
      const body = await command.advancedPlaylistSearch({ search: { uuids: [ 'dfd70b83-639f-4980-94af-304a56ab4b35' ] } })

      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    }
  })

  it('Should not display playlists without videos', async function () {
    const search = {
      search: 'Lunge',
      start: 0,
      count: 1
    }
    const body = await command.advancedPlaylistSearch({ search })
    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  after(async function () {
    await cleanupTests([ server, remoteServer ])
  })
})
