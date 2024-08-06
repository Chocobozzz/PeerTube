/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode, VideoPlaylistCreateResult } from '@peertube/peertube-models'
import { PeerTubeServer, cleanupTests, makeGetRequest } from '@peertube/peertube-server-commands'
import { getWatchPlaylistBasePaths, getWatchVideoBasePaths, prepareClientTests } from '@tests/shared/client.js'

describe('Test oEmbed HTML tags', function () {
  let servers: PeerTubeServer[]

  let videoIds: (string | number)[] = []

  let playlistName: string
  let playlist: VideoPlaylistCreateResult
  let playlistIds: (string | number)[] = []

  before(async function () {
    this.timeout(120000);

    ({ servers, playlistIds, videoIds, playlist, playlistName } = await prepareClientTests())
  })

  it('Should have valid oEmbed discovery tags for videos', async function () {
    for (const basePath of getWatchVideoBasePaths()) {
      for (const id of videoIds) {
        const res = await makeGetRequest({
          url: servers[0].url,
          path: basePath + id,
          accept: 'text/html',
          expectedStatus: HttpStatusCode.OK_200
        })

        const expectedLink = `<link rel="alternate" type="application/json+oembed" href="${servers[0].url}/services/oembed?` +
        `url=http%3A%2F%2F${servers[0].hostname}%3A${servers[0].port}%2Fw%2F${servers[0].store.video.shortUUID}" ` +
        `title="${servers[0].store.video.name}" />`

        expect(res.text).to.contain(expectedLink)
      }
    }
  })

  it('Should have valid oEmbed discovery tags for a playlist', async function () {
    for (const basePath of getWatchPlaylistBasePaths()) {
      for (const id of playlistIds) {
        const res = await makeGetRequest({
          url: servers[0].url,
          path: basePath + id,
          accept: 'text/html',
          expectedStatus: HttpStatusCode.OK_200
        })

        const expectedLink = `<link rel="alternate" type="application/json+oembed" href="${servers[0].url}/services/oembed?` +
          `url=http%3A%2F%2F${servers[0].hostname}%3A${servers[0].port}%2Fw%2Fp%2F${playlist.shortUUID}" ` +
          `title="${playlistName}" />`

        expect(res.text).to.contain(expectedLink)
      }
    }
  })

  it('Should forward query params to video oEmbed discrovery URL', async function () {
    const res = await makeGetRequest({
      url: servers[0].url,
      path: '/w/' + videoIds[0],
      query: {
        toto: 'hello',
        start: '1m2s'
      },
      accept: 'text/html',
      expectedStatus: HttpStatusCode.OK_200
    })

    const expectedLink = `<link rel="alternate" type="application/json+oembed" href="${servers[0].url}/services/oembed?` +
    `url=http%3A%2F%2F${servers[0].hostname}%3A${servers[0].port}%2Fw%2F${servers[0].store.video.shortUUID}%3Fstart%3D1m2s" ` +
    `title="${servers[0].store.video.name}" />`

    expect(res.text).to.contain(expectedLink)
  })

  it('Should forward query params to playlist oEmbed discrovery URL', async function () {
    const res = await makeGetRequest({
      url: servers[0].url,
      path: '/w/p/' + playlistIds[0],
      query: {
        toto: 'hello',
        playlistPosition: '415'
      },
      accept: 'text/html',
      expectedStatus: HttpStatusCode.OK_200
    })

    const expectedLink = `<link rel="alternate" type="application/json+oembed" href="${servers[0].url}/services/oembed?` +
    `url=http%3A%2F%2F${servers[0].hostname}%3A${servers[0].port}%2Fw%2Fp%2F${playlist.shortUUID}%3FplaylistPosition%3D415" ` +
    `title="${playlistName}" />`

    expect(res.text).to.contain(expectedLink)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
