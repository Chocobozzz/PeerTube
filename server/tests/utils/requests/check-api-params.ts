import { makeGetRequest } from './requests'
import { immutableAssign } from '..'

function checkBadStartPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { start: 'hello' }),
    statusCodeExpected: 400
  })
}

function checkBadCountPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { count: 'hello' }),
    statusCodeExpected: 400
  })
}

function checkBadSortPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { sort: 'hello' }),
    statusCodeExpected: 400
  })
}

// ---------------------------------------------------------------------------

export {
  checkBadStartPagination,
  checkBadCountPagination,
  checkBadSortPagination
}
