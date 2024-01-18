/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  makeRawRequest
} from '@peertube/peertube-server-commands'

describe('Test nginx', function () {

  it('Should serve public HLS/web video files', async function () {
    const urls = [
      // eslint-disable-next-line max-len
      'https://peertube2.cpy.re/static/streaming-playlists/hls/85c8e811-3eb7-4823-8dc5-3c268b6dad60/efad77e7-805d-4b20-8bc9-6e99cee38b20-240-fragmented.mp4',
      // eslint-disable-next-line max-len
      'https://peertube2.cpy.re/static/streaming-playlists/hls/85c8e811-3eb7-4823-8dc5-3c268b6dad60/1afbabfa-5f16-452e-8165-fe9a9a21cdb2-master.m3u8',
      // eslint-disable-next-line max-len
      'https://peertube2.cpy.re/static/streaming-playlists/hls/85c8e811-3eb7-4823-8dc5-3c268b6dad60/efad77e7-805d-4b20-8bc9-6e99cee38b20-240.m3u8'
    ]

    for (const url of urls) {
      await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
    }
  })

  it('Should not serve private HLS/web video files', async function () {
    const urls = [
      // eslint-disable-next-line max-len
      'https://peertube2.cpy.re/static/streaming-playlists/hls/private/72f0e8ee-84b9-44b1-9202-3e72ee7f1b65/531f27fe-bb86-42ed-9cf1-eb5bffc4a609-master.m3u8',
      // eslint-disable-next-line max-len
      'https://peertube2.cpy.re/static/streaming-playlists/hls/private/72f0e8ee-84b9-44b1-9202-3e72ee7f1b65/057dbf01-0557-414c-a546-a1cc82ac5d99-480.m3u8',
      // eslint-disable-next-line max-len
      'https://peertube2.cpy.re/static/streaming-playlists/hls/private/72f0e8ee-84b9-44b1-9202-3e72ee7f1b65/c9ef3aa7-5ab6-41c5-91c2-058c50a70c3c-segments-sha256.json',
      // eslint-disable-next-line max-len
      'https://peertube2.cpy.re/static/streaming-playlists/hls/private/72f0e8ee-84b9-44b1-9202-3e72ee7f1b65/057dbf01-0557-414c-a546-a1cc82ac5d99-480-fragmented.mp4',
      'https://peertube2.cpy.re/static/web-videos/private/72f0e8ee-84b9-44b1-9202-3e72ee7f1b65-480.mp4'
    ]

    for (const url of urls) {
      await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    }
  })
})
