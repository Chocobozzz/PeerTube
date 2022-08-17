/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { processViewersStats } from '@server/tests/shared'
import { HttpStatusCode, VideoPlaylistPrivacy, WatchActionObject } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeActivityPubGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@shared/server-commands'

describe('Test activitypub', function () {
  let servers: PeerTubeServer[] = []
  let video: { id: number, uuid: string, shortUUID: string }
  let playlist: { id: number, uuid: string, shortUUID: string }

  async function testAccount (path: string) {
    const res = await makeActivityPubGetRequest(servers[0].url, path)
    const object = res.body

    expect(object.type).to.equal('Person')
    expect(object.id).to.equal('http://localhost:' + servers[0].port + '/accounts/root')
    expect(object.name).to.equal('root')
    expect(object.preferredUsername).to.equal('root')
  }

  async function testChannel (path: string) {
    const res = await makeActivityPubGetRequest(servers[0].url, path)
    const object = res.body

    expect(object.type).to.equal('Group')
    expect(object.id).to.equal('http://localhost:' + servers[0].port + '/video-channels/root_channel')
    expect(object.name).to.equal('Main root channel')
    expect(object.preferredUsername).to.equal('root_channel')
  }

  async function testVideo (path: string) {
    const res = await makeActivityPubGetRequest(servers[0].url, path)
    const object = res.body

    expect(object.type).to.equal('Video')
    expect(object.id).to.equal('http://localhost:' + servers[0].port + '/videos/watch/' + video.uuid)
    expect(object.name).to.equal('video')
  }

  async function testPlaylist (path: string) {
    const res = await makeActivityPubGetRequest(servers[0].url, path)
    const object = res.body

    expect(object.type).to.equal('Playlist')
    expect(object.id).to.equal('http://localhost:' + servers[0].port + '/video-playlists/' + playlist.uuid)
    expect(object.name).to.equal('playlist')
  }

  before(async function () {
    this.timeout(30000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    {
      video = await servers[0].videos.quickUpload({ name: 'video' })
    }

    {
      const attributes = { displayName: 'playlist', privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: servers[0].store.channel.id }
      playlist = await servers[0].playlists.create({ attributes })
    }

    await doubleFollow(servers[0], servers[1])
  })

  it('Should return the account object', async function () {
    await testAccount('/accounts/root')
    await testAccount('/a/root')
  })

  it('Should return the channel object', async function () {
    await testChannel('/video-channels/root_channel')
    await testChannel('/c/root_channel')
  })

  it('Should return the video object', async function () {
    await testVideo('/videos/watch/' + video.id)
    await testVideo('/videos/watch/' + video.uuid)
    await testVideo('/videos/watch/' + video.shortUUID)
    await testVideo('/w/' + video.id)
    await testVideo('/w/' + video.uuid)
    await testVideo('/w/' + video.shortUUID)
  })

  it('Should return the playlist object', async function () {
    await testPlaylist('/video-playlists/' + playlist.id)
    await testPlaylist('/video-playlists/' + playlist.uuid)
    await testPlaylist('/video-playlists/' + playlist.shortUUID)
    await testPlaylist('/w/p/' + playlist.id)
    await testPlaylist('/w/p/' + playlist.uuid)
    await testPlaylist('/w/p/' + playlist.shortUUID)
    await testPlaylist('/videos/watch/playlist/' + playlist.id)
    await testPlaylist('/videos/watch/playlist/' + playlist.uuid)
    await testPlaylist('/videos/watch/playlist/' + playlist.shortUUID)
  })

  it('Should redirect to the origin video object', async function () {
    const res = await makeActivityPubGetRequest(servers[1].url, '/videos/watch/' + video.uuid, HttpStatusCode.FOUND_302)

    expect(res.header.location).to.equal('http://localhost:' + servers[0].port + '/videos/watch/' + video.uuid)
  })

  it('Should return the watch action', async function () {
    this.timeout(50000)

    await servers[0].views.simulateViewer({ id: video.uuid, currentTimes: [ 0, 2 ] })
    await processViewersStats(servers)

    const res = await makeActivityPubGetRequest(servers[0].url, '/videos/local-viewer/1', HttpStatusCode.OK_200)

    const object: WatchActionObject = res.body
    expect(object.type).to.equal('WatchAction')
    expect(object.duration).to.equal('PT2S')
    expect(object.actionStatus).to.equal('CompletedActionStatus')
    expect(object.watchSections).to.have.lengthOf(1)
    expect(object.watchSections[0].startTimestamp).to.equal(0)
    expect(object.watchSections[0].endTimestamp).to.equal(2)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
