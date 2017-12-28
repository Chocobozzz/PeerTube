import { makeGetRequest } from './requests'

function checkBadStartPagination (url: string, path: string) {
  return makeGetRequest({
    url,
    path,
    query: { start: 'hello' },
    statusCodeExpected: 400
  })
}

function checkBadCountPagination (url: string, path: string) {
  return makeGetRequest({
    url,
    path,
    query: { count: 'hello' },
    statusCodeExpected: 400
  })
}

function checkBadSortPagination (url: string, path: string) {
  return makeGetRequest({
    url,
    path,
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
