import { makeGetRequest } from './requests'

function checkBadStartPagination (url: string, path: string, token?: string) {
  return makeGetRequest({
    url,
    path,
    token,
    query: { start: 'hello' },
    statusCodeExpected: 400
  })
}

function checkBadCountPagination (url: string, path: string, token?: string) {
  return makeGetRequest({
    url,
    path,
    token,
    query: { count: 'hello' },
    statusCodeExpected: 400
  })
}

function checkBadSortPagination (url: string, path: string, token?: string) {
  return makeGetRequest({
    url,
    path,
    token,
    query: { sort: 'hello' },
    statusCodeExpected: 400
  })
}

// ---------------------------------------------------------------------------

export {
  checkBadStartPagination,
  checkBadCountPagination,
  checkBadSortPagination
}
