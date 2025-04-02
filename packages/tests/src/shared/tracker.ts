import { makeGetRequest } from '@peertube/peertube-server-commands'
import { expect } from 'chai'

export async function checkTrackerInfohash (serverUrl: string, infohash: string) {
  const path = '/tracker/announce'

  // From bittorrent-tracker
  const infohashBinary = escape(Buffer.from(infohash, 'hex').toString('binary')).replace(/[@*/+]/g, function (char) {
    return '%' + char.charCodeAt(0).toString(16).toUpperCase()
  })

  const res = await makeGetRequest({
    url: serverUrl,
    path,
    rawQuery: `peer_id=-WW0105-NkvYO/egUAr4&info_hash=${infohashBinary}&port=42100`,
    expectedStatus: 200
  })

  expect(res.text).to.not.contain('failure')
}
