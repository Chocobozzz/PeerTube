/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { processViewersStats } from '@tests/shared/views.js'
import { HttpStatusCode, VideoComment, VideoPlaylistPrivacy, WatchActionObject } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeActivityPubGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test activitypub', function () {
  let servers: PeerTubeServer[] = []
  let video: { id: number, uuid: string, shortUUID: string }
  let playlist: { id: number, uuid: string, shortUUID: string }
  let comment: VideoComment

  async function testAccount (path: string) {
    const res = await makeActivityPubGetRequest(servers[0].url, path)
    const object = res.body

    expect(object.type).to.equal('Person')
    expect(object.id).to.equal(servers[0].url + '/accounts/root')
    expect(object.name).to.equal('root')
    expect(object.preferredUsername).to.equal('root')
  }

  async function testChannel (path: string) {
    const res = await makeActivityPubGetRequest(servers[0].url, path)
    const object = res.body

    expect(object.type).to.equal('Group')
    expect(object.id).to.equal(servers[0].url + '/video-channels/root_channel')
    expect(object.name).to.equal('Main root channel')
    expect(object.preferredUsername).to.equal('root_channel')
  }

  async function testVideo (path: string) {
    const res = await makeActivityPubGetRequest(servers[0].url, path)
    const object = res.body

    expect(object.type).to.equal('Video')
    expect(object.id).to.equal(servers[0].url + '/videos/watch/' + video.uuid)
    expect(object.name).to.equal('video')
  }

  async function testComment (path: string) {
    const res = await makeActivityPubGetRequest(servers[0].url, path)
    const object = res.body

    expect(object.type).to.equal('Note')
    expect(object.id).to.equal(servers[0].url + '/videos/watch/' + video.uuid + '/comments/' + comment.id)
    expect(object.content).to.contain('thread')
    expect(object.inReplyTo).to.contain(servers[0].url + '/videos/watch/' + video.uuid)
    expect(object.attributedTo).to.equal(servers[0].url + '/accounts/root')
    expect(object.replyApproval).to.equal(servers[0].url + '/videos/watch/' + video.uuid + '/comments/' + comment.id + '/approve-reply')
  }

  async function testPlaylist (path: string) {
    const res = await makeActivityPubGetRequest(servers[0].url, path)
    const object = res.body

    expect(object.type).to.equal('Playlist')
    expect(object.id).to.equal(servers[0].url + '/video-playlists/' + playlist.uuid)
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

    comment = await servers[0].comments.createThread({ text: 'thread', videoId: video.id })

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

  it('Should return the video comment object', async function () {
    await testComment('/videos/watch/' + video.id + '/comments/' + comment.id)
    await testComment('/videos/watch/' + video.uuid + '/comments/' + comment.id)
    await testComment('/videos/watch/' + video.shortUUID + '/comments/' + comment.id)
    await testComment('/w/' + video.shortUUID + ';threadId=' + comment.id)
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

    expect(res.header.location).to.equal(servers[0].url + '/videos/watch/' + video.uuid)
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
