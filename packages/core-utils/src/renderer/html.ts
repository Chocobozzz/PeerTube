export function getDefaultSanitizeOptions () {
  return {
    allowedTags: [ 'a', 'p', 'span', 'br', 'strong', 'em', 'ul', 'ol', 'li' ],
    allowedSchemes: [ 'http', 'https' ],
    allowedAttributes: {
      'a': [ 'href', 'class', 'target', 'rel' ],
      '*': [ 'data-*' ]
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
}

export function getTextOnlySanitizeOptions () {
  return {
    allowedTags: [] as string[]
  }
}

export function getCustomMarkupSanitizeOptions (additionalAllowedTags: string[] = []) {
  const base = getDefaultSanitizeOptions()

  return {
    allowedTags: [
      ...base.allowedTags,
      ...additionalAllowedTags,
      'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img'
    ],
    allowedSchemes: [
      ...base.allowedSchemes,

      'mailto'
    ],
    allowedAttributes: {
      ...base.allowedAttributes,

      'img': [ 'src', 'alt' ],
      '*': [ 'data-*', 'style' ]
    }
  }
}

// Thanks: https://stackoverflow.com/a/12034334
export function escapeHTML (stringParam: string) {
  if (!stringParam) return ''

  const entityMap: { [id: string ]: string } = {
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

export function escapeAttribute (value: string) {
  if (!value) return ''

  return String(value).replace(/"/g, '&quot;')
}
