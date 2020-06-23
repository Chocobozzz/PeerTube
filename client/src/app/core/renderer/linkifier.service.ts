import { Injectable } from '@angular/core'
import { getAbsoluteAPIUrl } from '@app/helpers/utils'
import * as linkify from 'linkifyjs'
import linkifyHtml from 'linkifyjs/html'

@Injectable()
export class LinkifierService {

  static CLASSNAME = 'linkified'

  private linkifyOptions = {
    className: {
      mention: LinkifierService.CLASSNAME + '-mention',
      url: LinkifierService.CLASSNAME + '-url'
    }
  }

  constructor () {
    // Apply plugin
    this.mentionWithDomainPlugin(linkify)
  }

  linkify (text: string) {
    return linkifyHtml(text, this.linkifyOptions)
  }

  private mentionWithDomainPlugin (linkify: any) {
    const TT = linkify.scanner.TOKENS // Text tokens
    const { TOKENS: MT, State } = linkify.parser // Multi tokens, state
    const MultiToken = MT.Base
    const S_START = linkify.parser.start

    const TT_AT = TT.AT
    const TT_DOMAIN = TT.DOMAIN
    const TT_LOCALHOST = TT.LOCALHOST
    const TT_NUM = TT.NUM
    const TT_COLON = TT.COLON
    const TT_SLASH = TT.SLASH
    const TT_TLD = TT.TLD
    const TT_UNDERSCORE = TT.UNDERSCORE
    const TT_DOT = TT.DOT

    function MENTION (this: any, value: any) {
      this.v = value
    }

    linkify.inherits(MultiToken, MENTION, {
      type: 'mentionWithDomain',
      isLink: true,
      toHref () {
        return getAbsoluteAPIUrl() + '/services/redirect/accounts/' + this.toString().substr(1)
      }
    })

    const S_AT = S_START.jump(TT_AT) // @
    const S_AT_SYMS = new State()
    const S_MENTION = new State(MENTION)
    const S_MENTION_DIVIDER = new State()
    const S_MENTION_DIVIDER_SYMS = new State()

    // @_,
    S_AT.on(TT_UNDERSCORE, S_AT_SYMS)

    //  @_*
    S_AT_SYMS
      .on(TT_UNDERSCORE, S_AT_SYMS)
      .on(TT_DOT, S_AT_SYMS)

    // Valid mention (not made up entirely of symbols)
    S_AT
      .on(TT_DOMAIN, S_MENTION)
      .on(TT_LOCALHOST, S_MENTION)
      .on(TT_TLD, S_MENTION)
      .on(TT_NUM, S_MENTION)

    S_AT_SYMS
      .on(TT_DOMAIN, S_MENTION)
      .on(TT_LOCALHOST, S_MENTION)
      .on(TT_TLD, S_MENTION)
      .on(TT_NUM, S_MENTION)

    // More valid mentions
    S_MENTION
      .on(TT_DOMAIN, S_MENTION)
      .on(TT_LOCALHOST, S_MENTION)
      .on(TT_TLD, S_MENTION)
      .on(TT_COLON, S_MENTION)
      .on(TT_NUM, S_MENTION)
      .on(TT_UNDERSCORE, S_MENTION)

    // Mention with a divider
    S_MENTION
      .on(TT_AT, S_MENTION_DIVIDER)
      .on(TT_SLASH, S_MENTION_DIVIDER)
      .on(TT_DOT, S_MENTION_DIVIDER)

    // Mention _ trailing stash plus syms
    S_MENTION_DIVIDER.on(TT_UNDERSCORE, S_MENTION_DIVIDER_SYMS)
    S_MENTION_DIVIDER_SYMS.on(TT_UNDERSCORE, S_MENTION_DIVIDER_SYMS)

    // Once we get a word token, mentions can start up again
    S_MENTION_DIVIDER
      .on(TT_DOMAIN, S_MENTION)
      .on(TT_LOCALHOST, S_MENTION)
      .on(TT_TLD, S_MENTION)
      .on(TT_NUM, S_MENTION)

    S_MENTION_DIVIDER_SYMS
      .on(TT_DOMAIN, S_MENTION)
      .on(TT_LOCALHOST, S_MENTION)
      .on(TT_TLD, S_MENTION)
      .on(TT_NUM, S_MENTION)
  }
}
