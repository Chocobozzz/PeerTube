import { expect } from 'chai'
import { sha1 } from '@peertube/peertube-node-utils'
import { makeGetRequest } from '@peertube/peertube-server-commands'

async function hlsInfohashExist (serverUrl: string, masterPlaylistUrl: string, fileNumber: number) {
  const path = '/tracker/announce'

  const infohash = sha1(`2${masterPlaylistUrl}+V${fileNumber}`)

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

export {
  hlsInfohashExist
}
