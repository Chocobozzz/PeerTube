import { makeGetRequest } from '../requests/requests'

function getVideosOverview (url: string, useCache = false) {
  const path = '/api/v1/overviews/videos'

  const query = {
    t: useCache ? undefined : new Date().getTime()
  }

  return makeGetRequest({
    url,
    path,
    query,
    statusCodeExpected: 200
  })
}

export { getVideosOverview }
