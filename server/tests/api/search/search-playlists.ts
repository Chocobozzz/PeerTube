/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { VideoPlaylistPrivacy } from '@shared/models'
import {
  cleanupTests,
  flushAndRunServer,
  SearchCommand,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  uploadVideoAndGetId
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test playlists search', function () {
  let server: ServerInfo = null
  let command: SearchCommand

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    const videoId = (await uploadVideoAndGetId({ server: server, videoName: 'video' })).uuid

    {
      const attributes = {
        displayName: 'Dr. Kenzo Tenma hospital videos',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: server.videoChannel.id
      }
      const created = await server.playlistsCommand.create({ attributes })

      await server.playlistsCommand.addElement({ playlistId: created.id, attributes: { videoId } })
    }

    {
      const attributes = {
        displayName: 'Johan & Anna Libert musics',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: server.videoChannel.id
      }
      const created = await server.playlistsCommand.create({ attributes })

      await server.playlistsCommand.addElement({ playlistId: created.id, attributes: { videoId } })
    }

    {
      const attributes = {
        displayName: 'Inspector Lunge playlist',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: server.videoChannel.id
      }
      await server.playlistsCommand.create({ attributes })
    }

    command = server.searchCommand
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
        search: 'Anna Livert',
        start: 0,
        count: 1
      }
      const body = await command.advancedPlaylistSearch({ search })
      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)

      const playlist = body.data[0]
      expect(playlist.displayName).to.equal('Johan & Anna Libert musics')
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
    await cleanupTests([ server ])
  })
})
