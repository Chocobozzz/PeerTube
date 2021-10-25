import { HttpStatusCode } from '@shared/models'
import { makeGetRequest } from './requests'

function checkBadStartPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: { ...query, start: 'hello' },
    expectedStatus: HttpStatusCode.BAD_REQUEST_400
  })
}

async function checkBadCountPagination (url: string, path: string, token?: string, query = {}) {
  await makeGetRequest({
    url,
    path,
    token,
    query: { ...query, count: 'hello' },
    expectedStatus: HttpStatusCode.BAD_REQUEST_400
  })

  await makeGetRequest({
    url,
    path,
    token,
    query: { ...query, count: 2000 },
    expectedStatus: HttpStatusCode.BAD_REQUEST_400
  })
}

function checkBadSortPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: { ...query, sort: 'hello' },
    expectedStatus: HttpStatusCode.BAD_REQUEST_400
  })
}

// ---------------------------------------------------------------------------

export {
  checkBadStartPagination,
  checkBadCountPagination,
  checkBadSortPagination
}
