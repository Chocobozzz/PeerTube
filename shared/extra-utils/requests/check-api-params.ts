import { makeGetRequest } from './requests'
import { immutableAssign } from '../miscs/miscs'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function checkBadStartPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { start: 'hello' }),
    statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
  })
}

async function checkBadCountPagination (url: string, path: string, token?: string, query = {}) {
  await makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { count: 'hello' }),
    statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
  })

  await makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { count: 2000 }),
    statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
  })
}

function checkBadSortPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: immutableAssign(query, { sort: 'hello' }),
    statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
  })
}

// ---------------------------------------------------------------------------

export {
  checkBadStartPagination,
  checkBadCountPagination,
  checkBadSortPagination
}
