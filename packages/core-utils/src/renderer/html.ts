export function getDefaultSanitizedTags () {
  return [ 'a', 'p', 'span', 'br', 'strong', 'em', 'ul', 'ol', 'li' ]
}

export function getDefaultSanitizedSchemes () {
  return [ 'http', 'https' ]
}

export function getDefaultSanitizedHrefAttributes () {
  return [ 'href', 'class', 'target', 'rel' ]
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// sanitize-html
// ---------------------------------------------------------------------------

export function getDefaultSanitizeOptions () {
  return {
    allowedTags: getDefaultSanitizedTags(),
    allowedSchemes: getDefaultSanitizedSchemes(),
    allowedAttributes: {
      'a': getDefaultSanitizedHrefAttributes(),
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

// ---------------------------------------------------------------------------
// Manual escapes
// ---------------------------------------------------------------------------

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
