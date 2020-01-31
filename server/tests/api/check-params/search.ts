/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import { cleanupTests, flushAndRunServer, immutableAssign, makeGetRequest, ServerInfo } from '../../../../shared/extra-utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/extra-utils/requests/check-api-params'

describe('Test videos API validator', function () {
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
  })

  describe('When searching videos', function () {
    const path = '/api/v1/search/videos/'

    const query = {
      search: 'coucou'
    }

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, null, query)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, null, query)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, null, query)
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, query, statusCodeExpected: 200 })
    })

    it('Should fail with an invalid category', async function () {
      const customQuery1 = immutableAssign(query, { categoryOneOf: [ 'aa', 'b' ] })
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 400 })

      const customQuery2 = immutableAssign(query, { categoryOneOf: 'a' })
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 400 })
    })

    it('Should succeed with a valid category', async function () {
      const customQuery1 = immutableAssign(query, { categoryOneOf: [ 1, 7 ] })
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 200 })

      const customQuery2 = immutableAssign(query, { categoryOneOf: 1 })
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 200 })
    })

    it('Should fail with an invalid licence', async function () {
      const customQuery1 = immutableAssign(query, { licenceOneOf: [ 'aa', 'b' ] })
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 400 })

      const customQuery2 = immutableAssign(query, { licenceOneOf: 'a' })
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 400 })
    })

    it('Should succeed with a valid licence', async function () {
      const customQuery1 = immutableAssign(query, { licenceOneOf: [ 1, 2 ] })
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 200 })

      const customQuery2 = immutableAssign(query, { licenceOneOf: 1 })
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 200 })
    })

    it('Should succeed with a valid language', async function () {
      const customQuery1 = immutableAssign(query, { languageOneOf: [ 'fr', 'en' ] })
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 200 })

      const customQuery2 = immutableAssign(query, { languageOneOf: 'fr' })
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 200 })
    })

    it('Should succeed with valid tags', async function () {
      const customQuery1 = immutableAssign(query, { tagsOneOf: [ 'tag1', 'tag2' ] })
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 200 })

      const customQuery2 = immutableAssign(query, { tagsOneOf: 'tag1' })
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 200 })

      const customQuery3 = immutableAssign(query, { tagsAllOf: [ 'tag1', 'tag2' ] })
      await makeGetRequest({ url: server.url, path, query: customQuery3, statusCodeExpected: 200 })

      const customQuery4 = immutableAssign(query, { tagsAllOf: 'tag1' })
      await makeGetRequest({ url: server.url, path, query: customQuery4, statusCodeExpected: 200 })
    })

    it('Should fail with invalid durations', async function () {
      const customQuery1 = immutableAssign(query, { durationMin: 'hello' })
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 400 })

      const customQuery2 = immutableAssign(query, { durationMax: 'hello' })
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 400 })
    })

    it('Should fail with invalid dates', async function () {
      const customQuery1 = immutableAssign(query, { startDate: 'hello' })
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 400 })

      const customQuery2 = immutableAssign(query, { endDate: 'hello' })
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 400 })

      const customQuery3 = immutableAssign(query, { originallyPublishedStartDate: 'hello' })
      await makeGetRequest({ url: server.url, path, query: customQuery3, statusCodeExpected: 400 })

      const customQuery4 = immutableAssign(query, { originallyPublishedEndDate: 'hello' })
      await makeGetRequest({ url: server.url, path, query: customQuery4, statusCodeExpected: 400 })
    })
  })

  describe('When searching video channels', function () {
    const path = '/api/v1/search/video-channels/'

    const query = {
      search: 'coucou'
    }

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, null, query)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, null, query)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, null, query)
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, query, statusCodeExpected: 200 })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
