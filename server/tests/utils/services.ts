import * as request from 'supertest'

function getOEmbed (url: string, oembedUrl: string, format?: string, maxHeight?: number, maxWidth?: number) {
  const path = '/services/oembed'
  const query = {
    url: oembedUrl,
    format,
    maxheight: maxHeight,
    maxwidth: maxWidth
  }

  return request(url)
          .get(path)
          .query(query)
          .set('Accept', 'application/json')
          .expect(200)
}

// ---------------------------------------------------------------------------

export {
  getOEmbed
}
