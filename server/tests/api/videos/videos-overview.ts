/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { flushTests, killallServers, runServer, ServerInfo, setAccessTokensToServers, uploadVideo } from '../../utils'
import { getVideosOverview } from '../../utils/overviews/overviews'
import { VideosOverview } from '../../../../shared/models/overviews'

const expect = chai.expect

describe('Test a videos overview', function () {
  let server: ServerInfo = null

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])
  })

  it('Should send empty overview', async function () {
    const res = await getVideosOverview(server.url)

    const overview: VideosOverview = res.body
    expect(overview.tags).to.have.lengthOf(0)
    expect(overview.categories).to.have.lengthOf(0)
    expect(overview.channels).to.have.lengthOf(0)
  })

  it('Should upload 5 videos in a specific category, tag and channel but not include them in overview', async function () {
    this.timeout(15000)

    for (let i = 0; i < 5; i++) {
      await uploadVideo(server.url, server.accessToken, {
        name: 'video ' + i,
        category: 3,
        tags: [ 'coucou1', 'coucou2' ]
      })
    }

    const res = await getVideosOverview(server.url)

    const overview: VideosOverview = res.body
    expect(overview.tags).to.have.lengthOf(0)
    expect(overview.categories).to.have.lengthOf(0)
    expect(overview.channels).to.have.lengthOf(0)
  })

  it('Should upload another video and include all videos in the overview', async function () {
    await uploadVideo(server.url, server.accessToken, {
      name: 'video 5',
      category: 3,
      tags: [ 'coucou1', 'coucou2' ]
    })

    const res = await getVideosOverview(server.url)

    const overview: VideosOverview = res.body
    expect(overview.tags).to.have.lengthOf(2)
    expect(overview.categories).to.have.lengthOf(1)
    expect(overview.channels).to.have.lengthOf(1)
  })

  it('Should have the correct overview', async function () {
    const res = await getVideosOverview(server.url)

    const overview: VideosOverview = res.body

    for (const attr of [ 'tags', 'categories', 'channels' ]) {
      const obj = overview[attr][0]

      expect(obj.videos).to.have.lengthOf(6)
      expect(obj.videos[0].name).to.equal('video 5')
      expect(obj.videos[1].name).to.equal('video 4')
      expect(obj.videos[2].name).to.equal('video 3')
      expect(obj.videos[3].name).to.equal('video 2')
      expect(obj.videos[4].name).to.equal('video 1')
      expect(obj.videos[5].name).to.equal('video 0')
    }

    expect(overview.tags.find(t => t.tag === 'coucou1')).to.not.be.undefined
    expect(overview.tags.find(t => t.tag === 'coucou2')).to.not.be.undefined

    expect(overview.categories[0].category.id).to.equal(3)

    expect(overview.channels[0].channel.name).to.equal('root_channel')
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
