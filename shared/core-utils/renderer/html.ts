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

// Thanks: https://stackoverflow.com/a/12034334
export function escapeHTML (stringParam: string) {
  if (!stringParam) return ''

  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  }

  return String(stringParam).replace(/[&<>"'`=/]/g, s => entityMap[s])
}
