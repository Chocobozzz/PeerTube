export const SANITIZE_OPTIONS = {
  allowedTags: [ 'a', 'p', 'span', 'br', 'strong', 'em', 'ul', 'ol', 'li' ],
  allowedSchemes: [ 'http', 'https' ],
  allowedAttributes: {
    a: [ 'href', 'class', 'target', 'rel' ]
  },
  transformTags: {
    a: (tagName: string, attribs: any) => {
      let rel = 'noopener noreferrer'
      if (attribs.rel === 'me') rel += ' me'

      return {
        tagName,
        attribs: Object.assign(attribs, {
          target: '_blank',
          rel
        })
      }
    }
  }
}
