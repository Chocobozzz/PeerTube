import { getDefaultSanitizeOptions, getTextOnlySanitizeOptions, TEXT_WITH_HTML_RULES } from '@shared/core-utils'

const defaultSanitizeOptions = getDefaultSanitizeOptions()
const textOnlySanitizeOptions = getTextOnlySanitizeOptions()

const sanitizeHtml = require('sanitize-html')
const markdownItEmoji = require('markdown-it-emoji/light')
const MarkdownItClass = require('markdown-it')

const markdownItWithHTML = new MarkdownItClass('default', { linkify: true, breaks: true, html: true })
const markdownItWithoutHTML = new MarkdownItClass('default', { linkify: false, breaks: true, html: false })

const toSafeHtml = (text: string) => {
  if (!text) return ''

  // Restore line feed
  const textWithLineFeed = text.replace(/<br.?\/?>/g, '\r\n')

  // Convert possible markdown (emojis, emphasis and lists) to html
  const html = markdownItWithHTML.enable(TEXT_WITH_HTML_RULES)
                                 .use(markdownItEmoji)
                                 .render(textWithLineFeed)

  // Convert to safe Html
  return sanitizeHtml(html, defaultSanitizeOptions)
}

const mdToOneLinePlainText = (text: string) => {
  if (!text) return ''

  markdownItWithoutHTML.use(markdownItEmoji)
                       .use(plainTextPlugin)
                       .render(text)

  // Convert to safe Html
  return sanitizeHtml(markdownItWithoutHTML.plainText, textOnlySanitizeOptions)
}

// ---------------------------------------------------------------------------

export {
  toSafeHtml,
  mdToOneLinePlainText
}

// ---------------------------------------------------------------------------

// Thanks: https://github.com/wavesheep/markdown-it-plain-text
function plainTextPlugin (markdownIt: any) {
  let lastSeparator = ''

  function plainTextRule (state: any) {
    const text = scan(state.tokens)

    markdownIt.plainText = text.replace(/\s+/g, ' ')
  }

  function scan (tokens: any[]) {
    let text = ''

    for (const token of tokens) {
      if (token.children !== null) {
        text += scan(token.children)
        continue
      }

      if (token.type === 'list_item_close') {
        lastSeparator = ', '
      } else if (token.type.endsWith('_close')) {
        lastSeparator = ' '
      } else if (token.content) {
        text += lastSeparator
        text += token.content
      }
    }

    return text
  }

  markdownIt.core.ruler.push('plainText', plainTextRule)
}
