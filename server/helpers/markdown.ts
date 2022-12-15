import { getDefaultSanitizeOptions, getTextOnlySanitizeOptions, TEXT_WITH_HTML_RULES } from '@shared/core-utils'

const defaultSanitizeOptions = getDefaultSanitizeOptions()
const textOnlySanitizeOptions = getTextOnlySanitizeOptions()

const sanitizeHtml = require('sanitize-html')
const markdownItEmoji = require('markdown-it-emoji/light')
const MarkdownItClass = require('markdown-it')

const markdownItForSafeHtml = new MarkdownItClass('default', { linkify: true, breaks: true, html: true })
  .enable(TEXT_WITH_HTML_RULES)
  .use(markdownItEmoji)

const markdownItForPlainText = new MarkdownItClass('default', { linkify: false, breaks: true, html: false })
  .use(markdownItEmoji)
  .use(plainTextPlugin)

const toSafeHtml = (text: string) => {
  if (!text) return ''

  // Restore line feed
  const textWithLineFeed = text.replace(/<br.?\/?>/g, '\r\n')

  // Convert possible markdown (emojis, emphasis and lists) to html
  const html = markdownItForSafeHtml.render(textWithLineFeed)

  // Convert to safe Html
  return sanitizeHtml(html, defaultSanitizeOptions)
}

const mdToOneLinePlainText = (text: string) => {
  if (!text) return ''

  markdownItForPlainText.render(text)

  // Convert to safe Html
  return sanitizeHtml(markdownItForPlainText.plainText, textOnlySanitizeOptions)
}

// ---------------------------------------------------------------------------

export {
  toSafeHtml,
  mdToOneLinePlainText
}

// ---------------------------------------------------------------------------

// Thanks: https://github.com/wavesheep/markdown-it-plain-text
function plainTextPlugin (markdownIt: any) {
  function plainTextRule (state: any) {
    const text = scan(state.tokens)

    markdownIt.plainText = text
  }

  function scan (tokens: any[]) {
    let lastSeparator = ''
    let text = ''

    function buildSeparator (token: any) {
      if (token.type === 'list_item_close') {
        lastSeparator = ', '
      }

      if (token.tag === 'br' || token.type === 'paragraph_close') {
        lastSeparator = ' '
      }
    }

    for (const token of tokens) {
      buildSeparator(token)

      if (token.type !== 'inline') continue

      for (const child of token.children) {
        buildSeparator(child)

        if (!child.content) continue

        text += lastSeparator + child.content
        lastSeparator = ''
      }
    }

    return text
  }

  markdownIt.core.ruler.push('plainText', plainTextRule)
}
