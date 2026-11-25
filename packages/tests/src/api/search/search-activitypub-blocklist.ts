/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, ResultList, VideoPlaylistPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test ActivityPub search with blocklist', function () {
  let servers: PeerTubeServer[]
  let userToken: string

  let videoUUID: string
  let playlistUUID: string

  async function checkSearch (options: {
    token: string
    expected: number
  }) {
    const { token, expected } = options
    const remote = servers[1]
    const channelName = remote.store.channel.name

    const searchVideos = (search: string) => servers[0].search.searchVideos({ search, token })
    const searchChannels = (search: string) => servers[0].search.searchChannels({ search, token })
    const searchPlaylists = (search: string) => servers[0].search.searchPlaylists({ search, token })

    const searches: [string, (search: string) => Promise<ResultList<unknown>>][] = [
      [ remote.url + '/w/' + videoUUID, searchVideos ],
      [ remote.url + '/videos/watch/' + videoUUID, searchVideos ],
      [ remote.url + '/video-channels/' + channelName, searchChannels ],
      [ channelName + '@' + remote.host, searchChannels ],
      [ '@' + channelName + '@' + remote.host, searchChannels ],
      [ remote.url + '/video-playlists/' + playlistUUID, searchPlaylists ]
    ]

    for (const [ search, runSearch ] of searches) {
      const body = await runSearch(search)

      expect(body.total, search).to.equal(expected)
      expect(body.data, search).to.have.lengthOf(expected)
    }
  }

  // Objects are already fetched: the instance mute hides them to everyone, the user mute only to the user
  async function checkMutedByInstanceThenByUser (blocked: { server: string } | { account: string }) {
    await servers[0].blocklist.addToServerBlocklist(blocked)

    await checkSearch({ token: servers[0].accessToken, expected: 0 })
    await checkSearch({ token: userToken, expected: 0 })

    await servers[0].blocklist.removeFromServerBlocklist(blocked)

    await servers[0].blocklist.addToMyBlocklist({ token: userToken, ...blocked })

    await checkSearch({ token: userToken, expected: 0 })
    await checkSearch({ token: servers[0].accessToken, expected: 1 })

    await servers[0].blocklist.removeFromMyBlocklist({ token: userToken, ...blocked })
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    userToken = await servers[0].users.generateUserAndToken('user1')

    videoUUID = (await servers[1].videos.quickUpload({ name: 'video server 2' })).uuid

    const playlist = await servers[1].playlists.create({
      attributes: {
        displayName: 'playlist server 2',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[1].store.channel.id
      }
    })
    playlistUUID = playlist.uuid

    await servers[1].playlists.addElement({ playlistId: playlistUUID, attributes: { videoId: videoUUID } })

    await waitJobs(servers)
  })

  it('Should not search nor fetch objects of a server muted by the instance', async function () {
    await servers[0].blocklist.addToServerBlocklist({ server: servers[1].host })

    await checkSearch({ token: servers[0].accessToken, expected: 0 })
    await checkSearch({ token: userToken, expected: 0 })

    // The remote objects have not been fetched
    await servers[0].videos.get({ id: videoUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    await servers[0].playlists.get({ playlistId: playlistUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

    await servers[0].blocklist.removeFromServerBlocklist({ server: servers[1].host })
  })

  it('Should not search nor fetch objects of a server muted by the user', async function () {
    await servers[0].blocklist.addToMyBlocklist({ token: userToken, server: servers[1].host })

    await checkSearch({ token: userToken, expected: 0 })
    await servers[0].videos.get({ id: videoUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

    // Other users are not affected
    await checkSearch({ token: servers[0].accessToken, expected: 1 })

    await servers[0].blocklist.removeFromMyBlocklist({ token: userToken, server: servers[1].host })
  })

  it('Should not return already fetched objects of a server muted by the instance or by the user', async function () {
    await checkMutedByInstanceThenByUser({ server: servers[1].host })
  })

  it('Should not return objects of an account muted by the instance or by the user', async function () {
    await checkMutedByInstanceThenByUser({ account: 'root@' + servers[1].host })
  })

  it('Should search objects again after unmute', async function () {
    await checkSearch({ token: servers[0].accessToken, expected: 1 })
    await checkSearch({ token: userToken, expected: 1 })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
