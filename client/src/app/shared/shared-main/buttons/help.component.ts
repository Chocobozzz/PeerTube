import { booleanAttribute, Component, input, OnChanges, OnInit } from '@angular/core'
import { GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { ENHANCED_RULES, TEXT_RULES } from '@peertube/peertube-core-utils'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'

@Component({
  selector: 'my-help',
  styleUrls: [ './help.component.scss' ],
  templateUrl: './help.component.html',
  imports: [ NgbPopover, GlobalIconComponent ]
})
export class HelpComponent implements OnInit, OnChanges {
  readonly helpTitle = input('')
  readonly helpType = input<'custom' | 'markdownText' | 'markdownEnhanced'>('custom')
  readonly iconName = input<GlobalIconName>('help')
  readonly supportRelMe = input(false, { transform: booleanAttribute })

  readonly title = input($localize`Get help`)

  readonly tooltipPlacement = input('right auto')
  readonly autoClose = input('outside')
  readonly container = input<'body'>(undefined)

  isPopoverOpened = false
  markdownHTML = ''

  ngOnInit () {
    this.init()
  }

  ngOnChanges () {
    this.init()
  }

  onPopoverHidden () {
    this.isPopoverOpened = false
  }

  onPopoverShown () {
    this.isPopoverOpened = true
  }

  private init () {
    const helpType = this.helpType()
    if (helpType === 'markdownText') {
      this.markdownHTML = this.formatMarkdownSupport(TEXT_RULES)
      return
    }

    if (helpType === 'markdownEnhanced') {
      this.markdownHTML = this.formatMarkdownSupport(ENHANCED_RULES)
      return
    }
  }

  private formatMarkdownSupport (rules: string[]) {
    let str =
      // eslint-disable-next-line max-len
      $localize`<a href="https://en.wikipedia.org/wiki/Markdown#Example" target="_blank" rel="noopener noreferrer">Markdown</a> compatible that supports:` +
      this.createMarkdownList(rules)

    if (this.supportRelMe()) {
      str +=
        // eslint-disable-next-line max-len
        $localize`<a href="https://docs.joinmastodon.org/user/profile/#verification" target="_blank" rel="noopener noreferrer">Mastodon verification link</a> is also supported.`
    }

    return str
  }

  private createMarkdownList (rules: string[]) {
    const rulesToText: { [id: string]: string } = {
      emphasis: $localize`Emphasis`,
      link: $localize`Links`,
      newline: $localize`New lines`,
      list: $localize`Lists`,
      image: $localize`Images`
    }

    const bullets = rules.map(r => rulesToText[r])
      .filter(text => text)
      .map(text => '<li>' + text + '</li>')
      .join('')

    return '<ul>' + bullets + '</ul>'
  }
}
