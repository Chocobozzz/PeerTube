import { doRequest } from '@server/helpers/requests'

export function makePOSTAPRequest (url: string, body: any, httpSignature: any, headers: any) {
  const options = {
    method: 'POST' as 'POST',
    json: body,
    httpSignature,
    headers
  }

  return doRequest(url, options)
}
