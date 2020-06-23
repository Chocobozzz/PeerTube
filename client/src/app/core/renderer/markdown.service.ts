import * as MarkdownIt from 'markdown-it'
import { buildVideoLink } from 'src/assets/player/utils'
import { Injectable } from '@angular/core'
import { HtmlRendererService } from './html-renderer.service'

type MarkdownParsers = {
  textMarkdownIt: MarkdownIt
  textWithHTMLMarkdownIt: MarkdownIt

  enhancedMarkdownIt: MarkdownIt
  enhancedWithHTMLMarkdownIt: MarkdownIt

  completeMarkdownIt: MarkdownIt
}

type MarkdownConfig = {
  rules: string[]
  html: boolean
  escape?: boolean
}

type MarkdownParserConfigs = {
  [id in keyof MarkdownParsers]: MarkdownConfig
}

@Injectable()
export class MarkdownService {
  static TEXT_RULES = [
    'linkify',
    'autolink',
    'emphasis',
    'link',
    'newline',
    'list'
  ]
  static TEXT_WITH_HTML_RULES = MarkdownService.TEXT_RULES.concat([ 'html_inline', 'html_block' ])

  static ENHANCED_RULES = MarkdownService.TEXT_RULES.concat([ 'image' ])
  static ENHANCED_WITH_HTML_RULES = MarkdownService.TEXT_WITH_HTML_RULES.concat([ 'image' ])

  static COMPLETE_RULES = MarkdownService.ENHANCED_WITH_HTML_RULES.concat([ 'block', 'inline', 'heading', 'paragraph' ])

  private markdownParsers: MarkdownParsers = {
    textMarkdownIt: null,
    textWithHTMLMarkdownIt: null,
    enhancedMarkdownIt: null,
    enhancedWithHTMLMarkdownIt: null,
    completeMarkdownIt: null
  }
  private parsersConfig: MarkdownParserConfigs = {
    textMarkdownIt: { rules: MarkdownService.TEXT_RULES, html: false },
    textWithHTMLMarkdownIt: { rules: MarkdownService.TEXT_WITH_HTML_RULES, html: true, escape: true },

    enhancedMarkdownIt: { rules: MarkdownService.ENHANCED_RULES, html: false },
    enhancedWithHTMLMarkdownIt: { rules: MarkdownService.ENHANCED_WITH_HTML_RULES, html: true, escape: true },

    completeMarkdownIt: { rules: MarkdownService.COMPLETE_RULES, html: true }
  }

  constructor (private htmlRenderer: HtmlRendererService) {}

  textMarkdownToHTML (markdown: string, withHtml = false) {
    if (withHtml) return this.render('textWithHTMLMarkdownIt', markdown)

    return this.render('textMarkdownIt', markdown)
  }

  enhancedMarkdownToHTML (markdown: string, withHtml = false) {
    if (withHtml) return this.render('enhancedWithHTMLMarkdownIt', markdown)

    return this.render('enhancedMarkdownIt', markdown)
  }

  completeMarkdownToHTML (markdown: string) {
    return this.render('completeMarkdownIt', markdown)
  }

  async processVideoTimestamps (html: string) {
    return html.replace(/((\d{1,2}):)?(\d{1,2}):(\d{1,2})/g, function (str, _, h, m, s) {
      const t = (3600 * +(h || 0)) + (60 * +(m || 0)) + (+(s || 0))
      const url = buildVideoLink({ startTime: t })
      return `<a class="video-timestamp" href="${url}">${str}</a>`
    })
  }

  private async render (name: keyof MarkdownParsers, markdown: string) {
    if (!markdown) return ''

    const config = this.parsersConfig[ name ]
    if (!this.markdownParsers[ name ]) {
      this.markdownParsers[ name ] = await this.createMarkdownIt(config)
    }

    let html = this.markdownParsers[ name ].render(markdown)
    html = this.avoidTruncatedTags(html)

    if (config.escape) return this.htmlRenderer.toSafeHtml(html)

    return html
  }

  private async createMarkdownIt (config: MarkdownConfig) {
    // FIXME: import('...') returns a struct module, containing a "default" field
    const MarkdownItClass: typeof import ('markdown-it') = (await import('markdown-it') as any).default

    const markdownIt = new MarkdownItClass('zero', { linkify: true, breaks: true, html: config.html })

    for (const rule of config.rules) {
      markdownIt.enable(rule)
    }

    this.setTargetToLinks(markdownIt)

    return markdownIt
  }

  private setTargetToLinks (markdownIt: MarkdownIt) {
    // Snippet from markdown-it documentation: https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
    const defaultRender = markdownIt.renderer.rules.link_open || function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options)
    }

    markdownIt.renderer.rules.link_open = function (tokens, index, options, env, self) {
      const token = tokens[index]

      const targetIndex = token.attrIndex('target')
      if (targetIndex < 0) token.attrPush([ 'target', '_blank' ])
      else token.attrs[targetIndex][1] = '_blank'

      const relIndex = token.attrIndex('rel')
      if (relIndex < 0) token.attrPush([ 'rel', 'noopener noreferrer' ])
      else token.attrs[relIndex][1] = 'noopener noreferrer'

      // pass token to default renderer.
      return defaultRender(tokens, index, options, env, self)
    }
  }

  private avoidTruncatedTags (html: string) {
    return html.replace(/\*\*?([^*]+)$/, '$1')
      .replace(/<a[^>]+>([^<]+)<\/a>\s*...((<\/p>)|(<\/li>)|(<\/strong>))?$/mi, '$1...')
      .replace(/\[[^\]]+\]\(([^\)]+)$/m, '$1')
      .replace(/\s?\[[^\]]+\]?[.]{3}<\/p>$/m, '...</p>')
  }
}
