import { HttpStatusCode } from '@shared/core-utils'
import { makeGetRequest } from './requests'

function checkBadStartPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: { ...query, start: 'hello' },
    statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
  })
}

async function checkBadCountPagination (url: string, path: string, token?: string, query = {}) {
  await makeGetRequest({
    url,
    path,
    token,
    query: { ...query, count: 'hello' },
    statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
  })

  await makeGetRequest({
    url,
    path,
    token,
    query: { ...query, count: 2000 },
    statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
  })
}

function checkBadSortPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: { ...query, sort: 'hello' },
    statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
  })
}

// ---------------------------------------------------------------------------

export {
  checkBadStartPagination,
  checkBadCountPagination,
  checkBadSortPagination
}
