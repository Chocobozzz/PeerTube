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

export function getMailHtmlSanitizeOptions () {
  return {
    allowedTags: [ 'a', 'strong' ],
    allowedSchemes: getDefaultSanitizedSchemes(),
    allowedAttributes: {
      a: [ 'href', 'title' ]
    }
  }
}

export function getTextOnlySanitizeOptions () {
  return {
    allowedTags: [] as string[]
  }
}

// Sanitize options for user uploaded SVG files, to prevent XSS
export function getSanitizeSVGOptions () {
  return {
    allowedTags: [
      'svg',
      'g',
      'defs',
      'symbol',
      'use',
      'switch',
      'title',
      'desc',
      'metadata',
      'path',
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'text',
      'tspan',
      'textPath',
      'linearGradient',
      'radialGradient',
      'stop',
      'clipPath',
      'mask',
      'pattern',
      'marker',
      'image',
      'filter',
      'feBlend',
      'feColorMatrix',
      'feComponentTransfer',
      'feComposite',
      'feConvolveMatrix',
      'feDiffuseLighting',
      'feDisplacementMap',
      'feDistantLight',
      'feDropShadow',
      'feFlood',
      'feFuncA',
      'feFuncB',
      'feFuncG',
      'feFuncR',
      'feGaussianBlur',
      'feImage',
      'feMerge',
      'feMergeNode',
      'feMorphology',
      'feOffset',
      'fePointLight',
      'feSpecularLighting',
      'feSpotLight',
      'feTile',
      'feTurbulence'
    ],
    allowedAttributes: {
      '*': [
        // Core
        'id',
        'class',
        'style',
        'lang',
        // References
        'href',
        'xlink:href',
        'xlink:title',
        // Namespaces/versioning
        'xmlns',
        'xmlns:xlink',
        'version',
        'xml:space',
        'xml:lang',
        'baseProfile',
        // Geometry
        'x',
        'y',
        'x1',
        'y1',
        'x2',
        'y2',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'd',
        'points',
        'width',
        'height',
        'dx',
        'dy',
        'rotate',
        'pathLength',
        'transform',
        'gradientTransform',
        'patternTransform',
        'viewBox',
        'preserveAspectRatio',
        'offset',
        // Presentation
        'fill',
        'fill-opacity',
        'fill-rule',
        'clip-path',
        'clip-rule',
        'mask',
        'filter',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-dasharray',
        'stroke-dashoffset',
        'stroke-opacity',
        'stroke-miterlimit',
        'opacity',
        'color',
        'display',
        'visibility',
        'overflow',
        'vector-effect',
        'stop-color',
        'stop-opacity',
        'paint-order',
        'shape-rendering',
        'image-rendering',
        'color-interpolation',
        'color-interpolation-filters',
        // Text
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'text-anchor',
        'text-decoration',
        'letter-spacing',
        'word-spacing',
        'dominant-baseline',
        'alignment-baseline',
        'baseline-shift',
        'direction',
        'writing-mode',
        // Units
        'gradientUnits',
        'patternUnits',
        'patternContentUnits',
        'clipPathUnits',
        'maskUnits',
        'maskContentUnits',
        'markerUnits',
        'filterUnits',
        'primitiveUnits',
        'spreadMethod',
        'markerWidth',
        'markerHeight',
        'refX',
        'refY',
        'orient',
        // Filters
        'in',
        'in2',
        'result',
        'stdDeviation',
        'mode',
        'type',
        'values',
        'operator',
        'k1',
        'k2',
        'k3',
        'k4',
        'radius',
        'flood-color',
        'flood-opacity',
        'edgeMode',
        'tableValues',
        'slope',
        'intercept',
        'amplitude',
        'exponent',
        'baseFrequency',
        'numOctaves',
        'seed',
        'stitchTiles',
        'scale',
        'xChannelSelector',
        'yChannelSelector',
        'order',
        'kernelMatrix',
        'divisor',
        'bias',
        'targetX',
        'targetY',
        'preserveAlpha',
        'surfaceScale',
        'diffuseConstant',
        'specularConstant',
        'specularExponent',
        'azimuth',
        'elevation',
        'limitingConeAngle',
        'pointsAtX',
        'pointsAtY',
        'pointsAtZ',
        'z'
      ]
    },
    // Prevent javascript: and data: URLs
    allowedSchemes: getDefaultSanitizedSchemes(),
    allowedSchemesAppliedToAttributes: [ 'href', 'xlink:href' ],

    // SVG tags and attributes are case sensitive (e.g. viewBox, linearGradient) and use self-closing tags
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
      recognizeSelfClosing: true
    }
  }
}

// ---------------------------------------------------------------------------
// Manual escapes
// ---------------------------------------------------------------------------

// Thanks: https://stackoverflow.com/a/12034334
export function escapeHTML (stringParam: string) {
  if (!stringParam) return ''

  const entityMap: { [id: string]: string } = {
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

export function escapeHtmlJSONStr (jsonStr: string) {
  if (!jsonStr) return ''

  return jsonStr
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
