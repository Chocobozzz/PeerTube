/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { HttpStatusCode } from '@shared/core-utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination,
  cleanupTests,
  flushAndRunServer,
  makeGetRequest,
  ServerInfo,
  setAccessTokensToServers
} from '@shared/extra-utils'

function updateSearchIndex (server: ServerInfo, enabled: boolean, disableLocalSearch = false) {
  return server.configCommand.updateCustomSubConfig({
    newConfig: {
      search: {
        searchIndex: {
          enabled,
          disableLocalSearch
        }
      }
    }
  })
}

describe('Test videos API validator', function () {
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
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
      await makeGetRequest({ url: server.url, path, query, statusCodeExpected: HttpStatusCode.OK_200 })
    })

    it('Should fail with an invalid category', async function () {
      const customQuery1 = { ...query, categoryOneOf: [ 'aa', 'b' ] }
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })

      const customQuery2 = { ...query, categoryOneOf: 'a' }
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with a valid category', async function () {
      const customQuery1 = { ...query, categoryOneOf: [ 1, 7 ] }
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: HttpStatusCode.OK_200 })

      const customQuery2 = { ...query, categoryOneOf: 1 }
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: HttpStatusCode.OK_200 })
    })

    it('Should fail with an invalid licence', async function () {
      const customQuery1 = { ...query, licenceOneOf: [ 'aa', 'b' ] }
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })

      const customQuery2 = { ...query, licenceOneOf: 'a' }
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with a valid licence', async function () {
      const customQuery1 = { ...query, licenceOneOf: [ 1, 2 ] }
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: HttpStatusCode.OK_200 })

      const customQuery2 = { ...query, licenceOneOf: 1 }
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: HttpStatusCode.OK_200 })
    })

    it('Should succeed with a valid language', async function () {
      const customQuery1 = { ...query, languageOneOf: [ 'fr', 'en' ] }
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: HttpStatusCode.OK_200 })

      const customQuery2 = { ...query, languageOneOf: 'fr' }
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: HttpStatusCode.OK_200 })
    })

    it('Should succeed with valid tags', async function () {
      const customQuery1 = { ...query, tagsOneOf: [ 'tag1', 'tag2' ] }
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: HttpStatusCode.OK_200 })

      const customQuery2 = { ...query, tagsOneOf: 'tag1' }
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: HttpStatusCode.OK_200 })

      const customQuery3 = { ...query, tagsAllOf: [ 'tag1', 'tag2' ] }
      await makeGetRequest({ url: server.url, path, query: customQuery3, statusCodeExpected: HttpStatusCode.OK_200 })

      const customQuery4 = { ...query, tagsAllOf: 'tag1' }
      await makeGetRequest({ url: server.url, path, query: customQuery4, statusCodeExpected: HttpStatusCode.OK_200 })
    })

    it('Should fail with invalid durations', async function () {
      const customQuery1 = { ...query, durationMin: 'hello' }
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })

      const customQuery2 = { ...query, durationMax: 'hello' }
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with invalid dates', async function () {
      const customQuery1 = { ...query, startDate: 'hello' }
      await makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })

      const customQuery2 = { ...query, endDate: 'hello' }
      await makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })

      const customQuery3 = { ...query, originallyPublishedStartDate: 'hello' }
      await makeGetRequest({ url: server.url, path, query: customQuery3, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })

      const customQuery4 = { ...query, originallyPublishedEndDate: 'hello' }
      await makeGetRequest({ url: server.url, path, query: customQuery4, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })
    })
  })

  describe('When searching video playlists', function () {
    const path = '/api/v1/search/video-playlists/'

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
      await makeGetRequest({ url: server.url, path, query, statusCodeExpected: HttpStatusCode.OK_200 })
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
      await makeGetRequest({ url: server.url, path, query, statusCodeExpected: HttpStatusCode.OK_200 })
    })
  })

  describe('Search target', function () {

    it('Should fail/succeed depending on the search target', async function () {
      this.timeout(10000)

      const query = { search: 'coucou' }
      const paths = [
        '/api/v1/search/video-playlists/',
        '/api/v1/search/video-channels/',
        '/api/v1/search/videos/'
      ]

      for (const path of paths) {
        {
          const customQuery = { ...query, searchTarget: 'hello' }
          await makeGetRequest({ url: server.url, path, query: customQuery, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })
        }

        {
          const customQuery = { ...query, searchTarget: undefined }
          await makeGetRequest({ url: server.url, path, query: customQuery, statusCodeExpected: HttpStatusCode.OK_200 })
        }

        {
          const customQuery = { ...query, searchTarget: 'local' }
          await makeGetRequest({ url: server.url, path, query: customQuery, statusCodeExpected: HttpStatusCode.OK_200 })
        }

        {
          const customQuery = { ...query, searchTarget: 'search-index' }
          await makeGetRequest({ url: server.url, path, query: customQuery, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })
        }

        await updateSearchIndex(server, true, true)

        {
          const customQuery = { ...query, searchTarget: 'local' }
          await makeGetRequest({ url: server.url, path, query: customQuery, statusCodeExpected: HttpStatusCode.BAD_REQUEST_400 })
        }

        {
          const customQuery = { ...query, searchTarget: 'search-index' }
          await makeGetRequest({ url: server.url, path, query: customQuery, statusCodeExpected: HttpStatusCode.OK_200 })
        }

        await updateSearchIndex(server, true, false)

        {
          const customQuery = { ...query, searchTarget: 'local' }
          await makeGetRequest({ url: server.url, path, query: customQuery, statusCodeExpected: HttpStatusCode.OK_200 })
        }

        await updateSearchIndex(server, false, false)
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
