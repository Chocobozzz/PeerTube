import * as MarkdownIt from 'markdown-it'
import { buildVideoLink } from 'src/assets/player/utils'
import { Injectable } from '@angular/core'
import {
  COMPLETE_RULES,
  ENHANCED_RULES,
  ENHANCED_WITH_HTML_RULES,
  TEXT_RULES,
  TEXT_WITH_HTML_RULES
} from '@shared/core-utils/renderer/markdown'
import { HtmlRendererService } from './html-renderer.service'

type MarkdownParsers = {
  textMarkdownIt: MarkdownIt
  textWithHTMLMarkdownIt: MarkdownIt

  enhancedMarkdownIt: MarkdownIt
  enhancedWithHTMLMarkdownIt: MarkdownIt

  unsafeMarkdownIt: MarkdownIt

  customPageMarkdownIt: MarkdownIt
}

type MarkdownConfig = {
  rules: string[]
  html: boolean
  breaks: boolean
  escape?: boolean
}

type MarkdownParserConfigs = {
  [id in keyof MarkdownParsers]: MarkdownConfig
}

@Injectable()
export class MarkdownService {
  private markdownParsers: MarkdownParsers = {
    textMarkdownIt: null,
    textWithHTMLMarkdownIt: null,

    enhancedMarkdownIt: null,
    enhancedWithHTMLMarkdownIt: null,

    unsafeMarkdownIt: null,

    customPageMarkdownIt: null
  }
  private parsersConfig: MarkdownParserConfigs = {
    textMarkdownIt: { rules: TEXT_RULES, breaks: true, html: false },
    textWithHTMLMarkdownIt: { rules: TEXT_WITH_HTML_RULES, breaks: true, html: true, escape: true },

    enhancedMarkdownIt: { rules: ENHANCED_RULES, breaks: true, html: false },
    enhancedWithHTMLMarkdownIt: { rules: ENHANCED_WITH_HTML_RULES, breaks: true, html: true, escape: true },

    unsafeMarkdownIt: { rules: COMPLETE_RULES, breaks: true, html: true, escape: false },

    customPageMarkdownIt: { rules: COMPLETE_RULES, breaks: false, html: true, escape: true }
  }

  private emojiModule: any

  constructor (private htmlRenderer: HtmlRendererService) {}

  textMarkdownToHTML (markdown: string, withHtml = false, withEmoji = false) {
    if (withHtml) return this.render({ name: 'textWithHTMLMarkdownIt', markdown, withEmoji })

    return this.render({ name: 'textMarkdownIt', markdown, withEmoji })
  }

  enhancedMarkdownToHTML (markdown: string, withHtml = false, withEmoji = false) {
    if (withHtml) return this.render({ name: 'enhancedWithHTMLMarkdownIt', markdown, withEmoji })

    return this.render({ name: 'enhancedMarkdownIt', markdown, withEmoji })
  }

  unsafeMarkdownToHTML (markdown: string, _trustedInput: true) {
    return this.render({ name: 'unsafeMarkdownIt', markdown, withEmoji: true })
  }

  customPageMarkdownToHTML (markdown: string, additionalAllowedTags: string[]) {
    return this.render({ name: 'customPageMarkdownIt', markdown, withEmoji: true, additionalAllowedTags })
  }

  processVideoTimestamps (html: string) {
    return html.replace(/((\d{1,2}):)?(\d{1,2}):(\d{1,2})/g, function (str, _, h, m, s) {
      const t = (3600 * +(h || 0)) + (60 * +(m || 0)) + (+(s || 0))
      const url = buildVideoLink({ startTime: t })
      return `<a class="video-timestamp" href="${url}">${str}</a>`
    })
  }

  private async render (options: {
    name: keyof MarkdownParsers
    markdown: string
    withEmoji: boolean
    additionalAllowedTags?: string[]
  }) {
    const { name, markdown, withEmoji, additionalAllowedTags } = options
    if (!markdown) return ''

    const config = this.parsersConfig[ name ]
    if (!this.markdownParsers[ name ]) {
      this.markdownParsers[ name ] = await this.createMarkdownIt(config)

      if (withEmoji) {
        if (!this.emojiModule) {
          this.emojiModule = (await import('markdown-it-emoji/light')).default
        }

        this.markdownParsers[ name ].use(this.emojiModule)
      }
    }

    let html = this.markdownParsers[ name ].render(markdown)
    html = this.avoidTruncatedTags(html)

    if (config.escape) return this.htmlRenderer.toSafeHtml(html, additionalAllowedTags)

    return html
  }

  private async createMarkdownIt (config: MarkdownConfig) {
    // FIXME: import('...') returns a struct module, containing a "default" field
    const MarkdownItClass: typeof import ('markdown-it') = (await import('markdown-it') as any).default

    const markdownIt = new MarkdownItClass('zero', { linkify: true, breaks: config.breaks, html: config.html })

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
