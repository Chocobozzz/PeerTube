import {
  getDefaultSanitizeOptions,
  getMailHtmlSanitizeOptions,
  getTextOnlySanitizeOptions,
  TEXT_WITH_HTML_RULES
} from '@peertube/peertube-core-utils'
import MarkdownItClass from 'markdown-it'
import markdownItEmoji from 'markdown-it-emoji/lib/light.mjs'
import sanitizeHtml from 'sanitize-html'

const defaultSanitizeOptions = getDefaultSanitizeOptions()
const textOnlySanitizeOptions = getTextOnlySanitizeOptions()
const hrefOnlySanitizeOptions = getMailHtmlSanitizeOptions()

const markdownItForSafeHtml = new MarkdownItClass('default', { linkify: true, breaks: true, html: true })
  .enable(TEXT_WITH_HTML_RULES)
  .use(markdownItEmoji)

const markdownItForPlainText = new MarkdownItClass('default', { linkify: false, breaks: true, html: false })
  .use(markdownItEmoji)
  .use(plainTextPlugin)

export const toSafeHtml = (text: string) => {
  if (!text) return ''

  // Restore line feed
  const textWithLineFeed = text.replace(/<br.?\/?>/g, '\r\n')

  // Convert possible markdown (emojis, emphasis and lists) to html
  const html = markdownItForSafeHtml.render(textWithLineFeed)

  // Convert to safe Html
  return sanitizeHtml(html, defaultSanitizeOptions)
}

export const mdToPlainText = (text: string) => {
  if (!text) return ''

  markdownItForPlainText.render(text)

  // Convert to safe Html
  return sanitizeHtml(markdownItForPlainText.plainText, textOnlySanitizeOptions)
}

export const toSafeMailHtml = (text: string) => {
  if (!text) return ''

  return sanitizeHtml(text, hrefOnlySanitizeOptions)
}

// ---------------------------------------------------------------------------
// Private
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
