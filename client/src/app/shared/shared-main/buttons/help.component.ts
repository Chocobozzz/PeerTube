import { NgIf, NgTemplateOutlet } from '@angular/common'
import {
  AfterContentInit,
  booleanAttribute,
  Component,
  ContentChildren,
  Input,
  OnChanges,
  OnInit,
  QueryList,
  TemplateRef
} from '@angular/core'
import { GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { ENHANCED_RULES, TEXT_RULES } from '@peertube/peertube-core-utils'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { PeerTubeTemplateDirective } from '../common/peertube-template.directive'

@Component({
  selector: 'my-help',
  styleUrls: [ './help.component.scss' ],
  templateUrl: './help.component.html',
  standalone: true,
  imports: [ NgIf, NgTemplateOutlet, NgbPopover, GlobalIconComponent ]
})

export class HelpComponent implements OnInit, OnChanges, AfterContentInit {
  @Input() helpType: 'custom' | 'markdownText' | 'markdownEnhanced' = 'custom'
  @Input() tooltipPlacement = 'right auto'
  @Input() iconName: GlobalIconName = 'help'
  @Input() title = $localize`Get help`
  @Input() autoClose = 'outside'
  @Input({ transform: booleanAttribute }) supportRelMe = false

  @ContentChildren(PeerTubeTemplateDirective) templates: QueryList<PeerTubeTemplateDirective<'preHtml' | 'customHtml' | 'postHtml'>>

  isPopoverOpened = false
  mainHtml = ''

  preHtmlTemplate: TemplateRef<any>
  customHtmlTemplate: TemplateRef<any>
  postHtmlTemplate: TemplateRef<any>

  ngOnInit () {
    this.init()
  }

  ngAfterContentInit () {
    {
      const t = this.templates.find(t => t.name === 'preHtml')
      if (t) this.preHtmlTemplate = t.template
    }

    {
      const t = this.templates.find(t => t.name === 'customHtml')
      if (t) this.customHtmlTemplate = t.template
    }

    {
      const t = this.templates.find(t => t.name === 'postHtml')
      if (t) this.postHtmlTemplate = t.template
    }
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
    if (this.helpType === 'markdownText') {
      this.mainHtml = this.formatMarkdownSupport(TEXT_RULES)
      return
    }

    if (this.helpType === 'markdownEnhanced') {
      this.mainHtml = this.formatMarkdownSupport(ENHANCED_RULES)
      return
    }
  }

  private formatMarkdownSupport (rules: string[]) {
    let str =
      // eslint-disable-next-line max-len
      $localize`<a href="https://en.wikipedia.org/wiki/Markdown#Example" target="_blank" rel="noopener noreferrer">Markdown</a> compatible that supports:` +
      this.createMarkdownList(rules)

    if (this.supportRelMe) {
      // eslint-disable-next-line max-len
      str += $localize`<a href="https://docs.joinmastodon.org/user/profile/#verification" target="_blank" rel="noopener noreferrer">Mastodon verification link</a> is also supported.`
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
