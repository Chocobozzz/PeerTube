import { makeGetRequest } from './requests'
import { immutableAssign } from '../miscs/miscs'

function checkBadStartPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { start: 'hello' }),
    statusCodeExpected: 400
  })
}

async function checkBadCountPagination (url: string, path: string, token?: string, query = {}) {
  await makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { count: 'hello' }),
    statusCodeExpected: 400
  })

  await makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { count: 2000 }),
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
