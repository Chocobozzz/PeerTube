/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  advancedVideosSearch,
  cleanupTests,
  flushAndRunServer,
  immutableAssign,
  searchVideo,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  wait
} from '../../../../shared/extra-utils'
import { createVideoCaption } from '../../../../shared/extra-utils/videos/video-captions'

const expect = chai.expect

describe('Test videos search', function () {
  let server: ServerInfo = null
  let startDate: string
  let videoUUID: string

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    {
      const attributes1 = {
        name: '1111 2222 3333',
        fixture: '60fps_720p_small.mp4', // 2 seconds
        category: 1,
        licence: 1,
        nsfw: false,
        language: 'fr'
      }
      await uploadVideo(server.url, server.accessToken, attributes1)

      const attributes2 = immutableAssign(attributes1, { name: attributes1.name + ' - 2', fixture: 'video_short.mp4' })
      await uploadVideo(server.url, server.accessToken, attributes2)

      {
        const attributes3 = immutableAssign(attributes1, { name: attributes1.name + ' - 3', language: undefined })
        const res = await uploadVideo(server.url, server.accessToken, attributes3)
        const videoId = res.body.video.id
        videoUUID = res.body.video.uuid

        await createVideoCaption({
          url: server.url,
          accessToken: server.accessToken,
          language: 'en',
          videoId,
          fixture: 'subtitle-good2.vtt',
          mimeType: 'application/octet-stream'
        })

        await createVideoCaption({
          url: server.url,
          accessToken: server.accessToken,
          language: 'aa',
          videoId,
          fixture: 'subtitle-good2.vtt',
          mimeType: 'application/octet-stream'
        })
      }

      const attributes4 = immutableAssign(attributes1, { name: attributes1.name + ' - 4', language: 'pl', nsfw: true })
      await uploadVideo(server.url, server.accessToken, attributes4)

      await wait(1000)

      startDate = new Date().toISOString()

      const attributes5 = immutableAssign(attributes1, { name: attributes1.name + ' - 5', licence: 2, language: undefined })
      await uploadVideo(server.url, server.accessToken, attributes5)

      const attributes6 = immutableAssign(attributes1, { name: attributes1.name + ' - 6', tags: [ 't1', 't2' ] })
      await uploadVideo(server.url, server.accessToken, attributes6)

      const attributes7 = immutableAssign(attributes1, {
        name: attributes1.name + ' - 7',
        originallyPublishedAt: '2019-02-12T09:58:08.286Z'
      })
      await uploadVideo(server.url, server.accessToken, attributes7)

      const attributes8 = immutableAssign(attributes1, { name: attributes1.name + ' - 8', licence: 4 })
      await uploadVideo(server.url, server.accessToken, attributes8)
    }

    {
      const attributes = {
        name: '3333 4444 5555',
        fixture: 'video_short.mp4',
        category: 2,
        licence: 2,
        language: 'en'
      }
      await uploadVideo(server.url, server.accessToken, attributes)

      await uploadVideo(server.url, server.accessToken, immutableAssign(attributes, { name: attributes.name + ' duplicate' }))
    }

    {
      const attributes = {
        name: '6666 7777 8888',
        fixture: 'video_short.mp4',
        category: 3,
        licence: 3,
        language: 'pl'
      }
      await uploadVideo(server.url, server.accessToken, attributes)
    }

    {
      const attributes1 = {
        name: '9999',
        tags: [ 'aaaa', 'bbbb', 'cccc' ],
        category: 1
      }
      await uploadVideo(server.url, server.accessToken, attributes1)
      await uploadVideo(server.url, server.accessToken, immutableAssign(attributes1, { category: 2 }))

      await uploadVideo(server.url, server.accessToken, immutableAssign(attributes1, { tags: [ 'cccc', 'dddd' ] }))
      await uploadVideo(server.url, server.accessToken, immutableAssign(attributes1, { tags: [ 'eeee', 'ffff' ] }))
    }

    {
      const attributes1 = {
        name: 'aaaa 2',
        category: 1
      }
      await uploadVideo(server.url, server.accessToken, attributes1)
      await uploadVideo(server.url, server.accessToken, immutableAssign(attributes1, { category: 2 }))
    }
  })

  it('Should make a simple search and not have results', async function () {
    const res = await searchVideo(server.url, 'abc')

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should make a simple search and have results', async function () {
    const res = await searchVideo(server.url, '4444 5555 duplicate')

    expect(res.body.total).to.equal(2)

    const videos = res.body.data
    expect(videos).to.have.lengthOf(2)

    // bestmatch
    expect(videos[0].name).to.equal('3333 4444 5555 duplicate')
    expect(videos[1].name).to.equal('3333 4444 5555')
  })

  it('Should make a search on tags too, and have results', async function () {
    const query = {
      search: 'aaaa',
      categoryOneOf: [ 1 ]
    }
    const res = await advancedVideosSearch(server.url, query)

    expect(res.body.total).to.equal(2)

    const videos = res.body.data
    expect(videos).to.have.lengthOf(2)

    // bestmatch
    expect(videos[0].name).to.equal('aaaa 2')
    expect(videos[1].name).to.equal('9999')
  })

  it('Should filter on tags without a search', async function () {
    const query = {
      tagsAllOf: [ 'bbbb' ]
    }
    const res = await advancedVideosSearch(server.url, query)

    expect(res.body.total).to.equal(2)

    const videos = res.body.data
    expect(videos).to.have.lengthOf(2)

    expect(videos[0].name).to.equal('9999')
    expect(videos[1].name).to.equal('9999')
  })

  it('Should filter on category without a search', async function () {
    const query = {
      categoryOneOf: [ 3 ]
    }
    const res = await advancedVideosSearch(server.url, query)

    expect(res.body.total).to.equal(1)

    const videos = res.body.data
    expect(videos).to.have.lengthOf(1)

    expect(videos[0].name).to.equal('6666 7777 8888')
  })

  it('Should search by tags (one of)', async function () {
    const query = {
      search: '9999',
      categoryOneOf: [ 1 ],
      tagsOneOf: [ 'aAaa', 'ffff' ]
    }
    const res1 = await advancedVideosSearch(server.url, query)
    expect(res1.body.total).to.equal(2)

    const res2 = await advancedVideosSearch(server.url, immutableAssign(query, { tagsOneOf: [ 'blabla' ] }))
    expect(res2.body.total).to.equal(0)
  })

  it('Should search by tags (all of)', async function () {
    const query = {
      search: '9999',
      categoryOneOf: [ 1 ],
      tagsAllOf: [ 'CCcc' ]
    }
    const res1 = await advancedVideosSearch(server.url, query)
    expect(res1.body.total).to.equal(2)

    const res2 = await advancedVideosSearch(server.url, immutableAssign(query, { tagsAllOf: [ 'blAbla' ] }))
    expect(res2.body.total).to.equal(0)

    const res3 = await advancedVideosSearch(server.url, immutableAssign(query, { tagsAllOf: [ 'bbbb', 'CCCC' ] }))
    expect(res3.body.total).to.equal(1)
  })

  it('Should search by category', async function () {
    const query = {
      search: '6666',
      categoryOneOf: [ 3 ]
    }
    const res1 = await advancedVideosSearch(server.url, query)
    expect(res1.body.total).to.equal(1)
    expect(res1.body.data[0].name).to.equal('6666 7777 8888')

    const res2 = await advancedVideosSearch(server.url, immutableAssign(query, { categoryOneOf: [ 2 ] }))
    expect(res2.body.total).to.equal(0)
  })

  it('Should search by licence', async function () {
    const query = {
      search: '4444 5555',
      licenceOneOf: [ 2 ]
    }
    const res1 = await advancedVideosSearch(server.url, query)
    expect(res1.body.total).to.equal(2)
    expect(res1.body.data[0].name).to.equal('3333 4444 5555')
    expect(res1.body.data[1].name).to.equal('3333 4444 5555 duplicate')

    const res2 = await advancedVideosSearch(server.url, immutableAssign(query, { licenceOneOf: [ 3 ] }))
    expect(res2.body.total).to.equal(0)
  })

  it('Should search by languages', async function () {
    const query = {
      search: '1111 2222 3333',
      languageOneOf: [ 'pl', 'en' ]
    }

    {
      const res = await advancedVideosSearch(server.url, query)
      expect(res.body.total).to.equal(2)
      expect(res.body.data[0].name).to.equal('1111 2222 3333 - 3')
      expect(res.body.data[1].name).to.equal('1111 2222 3333 - 4')
    }

    {
      const res = await advancedVideosSearch(server.url, immutableAssign(query, { languageOneOf: [ 'pl', 'en', '_unknown' ] }))
      expect(res.body.total).to.equal(3)
      expect(res.body.data[0].name).to.equal('1111 2222 3333 - 3')
      expect(res.body.data[1].name).to.equal('1111 2222 3333 - 4')
      expect(res.body.data[2].name).to.equal('1111 2222 3333 - 5')
    }

    {
      const res = await advancedVideosSearch(server.url, immutableAssign(query, { languageOneOf: [ 'eo' ] }))
      expect(res.body.total).to.equal(0)
    }
  })

  it('Should search by start date', async function () {
    const query = {
      search: '1111 2222 3333',
      startDate
    }

    const res = await advancedVideosSearch(server.url, query)
    expect(res.body.total).to.equal(4)

    const videos = res.body.data
    expect(videos[0].name).to.equal('1111 2222 3333 - 5')
    expect(videos[1].name).to.equal('1111 2222 3333 - 6')
    expect(videos[2].name).to.equal('1111 2222 3333 - 7')
    expect(videos[3].name).to.equal('1111 2222 3333 - 8')
  })

  it('Should make an advanced search', async function () {
    const query = {
      search: '1111 2222 3333',
      languageOneOf: [ 'pl', 'fr' ],
      durationMax: 4,
      nsfw: 'false' as 'false',
      licenceOneOf: [ 1, 4 ]
    }

    const res = await advancedVideosSearch(server.url, query)
    expect(res.body.total).to.equal(4)

    const videos = res.body.data
    expect(videos[0].name).to.equal('1111 2222 3333')
    expect(videos[1].name).to.equal('1111 2222 3333 - 6')
    expect(videos[2].name).to.equal('1111 2222 3333 - 7')
    expect(videos[3].name).to.equal('1111 2222 3333 - 8')
  })

  it('Should make an advanced search and sort results', async function () {
    const query = {
      search: '1111 2222 3333',
      languageOneOf: [ 'pl', 'fr' ],
      durationMax: 4,
      nsfw: 'false' as 'false',
      licenceOneOf: [ 1, 4 ],
      sort: '-name'
    }

    const res = await advancedVideosSearch(server.url, query)
    expect(res.body.total).to.equal(4)

    const videos = res.body.data
    expect(videos[0].name).to.equal('1111 2222 3333 - 8')
    expect(videos[1].name).to.equal('1111 2222 3333 - 7')
    expect(videos[2].name).to.equal('1111 2222 3333 - 6')
    expect(videos[3].name).to.equal('1111 2222 3333')
  })

  it('Should make an advanced search and only show the first result', async function () {
    const query = {
      search: '1111 2222 3333',
      languageOneOf: [ 'pl', 'fr' ],
      durationMax: 4,
      nsfw: 'false' as 'false',
      licenceOneOf: [ 1, 4 ],
      sort: '-name',
      start: 0,
      count: 1
    }

    const res = await advancedVideosSearch(server.url, query)
    expect(res.body.total).to.equal(4)

    const videos = res.body.data
    expect(videos[0].name).to.equal('1111 2222 3333 - 8')
  })

  it('Should make an advanced search and only show the last result', async function () {
    const query = {
      search: '1111 2222 3333',
      languageOneOf: [ 'pl', 'fr' ],
      durationMax: 4,
      nsfw: 'false' as 'false',
      licenceOneOf: [ 1, 4 ],
      sort: '-name',
      start: 3,
      count: 1
    }

    const res = await advancedVideosSearch(server.url, query)
    expect(res.body.total).to.equal(4)

    const videos = res.body.data
    expect(videos[0].name).to.equal('1111 2222 3333')
  })

  it('Should search on originally published date', async function () {
    const baseQuery = {
      search: '1111 2222 3333',
      languageOneOf: [ 'pl', 'fr' ],
      durationMax: 4,
      nsfw: 'false' as 'false',
      licenceOneOf: [ 1, 4 ]
    }

    {
      const query = immutableAssign(baseQuery, { originallyPublishedStartDate: '2019-02-11T09:58:08.286Z' })
      const res = await advancedVideosSearch(server.url, query)

      expect(res.body.total).to.equal(1)
      expect(res.body.data[0].name).to.equal('1111 2222 3333 - 7')
    }

    {
      const query = immutableAssign(baseQuery, { originallyPublishedEndDate: '2019-03-11T09:58:08.286Z' })
      const res = await advancedVideosSearch(server.url, query)

      expect(res.body.total).to.equal(1)
      expect(res.body.data[0].name).to.equal('1111 2222 3333 - 7')
    }

    {
      const query = immutableAssign(baseQuery, { originallyPublishedEndDate: '2019-01-11T09:58:08.286Z' })
      const res = await advancedVideosSearch(server.url, query)

      expect(res.body.total).to.equal(0)
    }

    {
      const query = immutableAssign(baseQuery, { originallyPublishedStartDate: '2019-03-11T09:58:08.286Z' })
      const res = await advancedVideosSearch(server.url, query)

      expect(res.body.total).to.equal(0)
    }

    {
      const query = immutableAssign(baseQuery, {
        originallyPublishedStartDate: '2019-01-11T09:58:08.286Z',
        originallyPublishedEndDate: '2019-01-10T09:58:08.286Z'
      })
      const res = await advancedVideosSearch(server.url, query)

      expect(res.body.total).to.equal(0)
    }

    {
      const query = immutableAssign(baseQuery, {
        originallyPublishedStartDate: '2019-01-11T09:58:08.286Z',
        originallyPublishedEndDate: '2019-04-11T09:58:08.286Z'
      })
      const res = await advancedVideosSearch(server.url, query)

      expect(res.body.total).to.equal(1)
      expect(res.body.data[0].name).to.equal('1111 2222 3333 - 7')
    }
  })

  it('Should search by UUID', async function () {
    const search = videoUUID
    const res = await advancedVideosSearch(server.url, { search })

    expect(res.body.total).to.equal(1)
    expect(res.body.data[0].name).to.equal('1111 2222 3333 - 3')
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
