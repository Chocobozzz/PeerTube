/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  advancedVideosSearch,
  flushTests,
  killallServers,
  runServer,
  searchVideo,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  wait,
  immutableAssign
} from '../../utils'

const expect = chai.expect

describe('Test a videos search', function () {
  let server: ServerInfo = null
  let startDate: string

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

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

      const attributes3 = immutableAssign(attributes1, { name: attributes1.name + ' - 3', language: 'en' })
      await uploadVideo(server.url, server.accessToken, attributes3)

      const attributes4 = immutableAssign(attributes1, { name: attributes1.name + ' - 4', language: 'pl', nsfw: true })
      await uploadVideo(server.url, server.accessToken, attributes4)

      await wait(1000)

      startDate = new Date().toISOString()

      const attributes5 = immutableAssign(attributes1, { name: attributes1.name + ' - 5', licence: 2 })
      await uploadVideo(server.url, server.accessToken, attributes5)

      const attributes6 = immutableAssign(attributes1, { name: attributes1.name + ' - 6', tags: [ 't1', 't2 '] })
      await uploadVideo(server.url, server.accessToken, attributes6)

      const attributes7 = immutableAssign(attributes1, { name: attributes1.name + ' - 7' })
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
      tagsOneOf: [ 'aaaa', 'ffff' ]
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
      tagsAllOf: [ 'cccc' ]
    }
    const res1 = await advancedVideosSearch(server.url, query)
    expect(res1.body.total).to.equal(2)

    const res2 = await advancedVideosSearch(server.url, immutableAssign(query, { tagsAllOf: [ 'blabla' ] }))
    expect(res2.body.total).to.equal(0)

    const res3 = await advancedVideosSearch(server.url, immutableAssign(query, { tagsAllOf: [ 'bbbb', 'cccc' ] }))
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
    const res1 = await advancedVideosSearch(server.url, query)
    expect(res1.body.total).to.equal(2)
    expect(res1.body.data[0].name).to.equal('1111 2222 3333 - 3')
    expect(res1.body.data[1].name).to.equal('1111 2222 3333 - 4')

    const res2 = await advancedVideosSearch(server.url, immutableAssign(query, { languageOneOf: [ 'eo' ] }))
    expect(res2.body.total).to.equal(0)
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

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
