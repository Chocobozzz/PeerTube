import { immutableAssign } from './object'

function objectLineFeedToHtml (obj: any, keyToNormalize: string) {
  return immutableAssign(obj, {
    [keyToNormalize]: lineFeedToHtml(obj[keyToNormalize])
  })
}

function lineFeedToHtml (text: string) {
  if (!text) return text

  return text.replace(/\r?\n|\r/g, '<br />')
}

export {
  objectLineFeedToHtml,
  lineFeedToHtml
}
