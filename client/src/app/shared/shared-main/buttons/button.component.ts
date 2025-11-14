import { ObserversModule } from '@angular/cdk/observers'
import { NgClass, NgTemplateOutlet } from '@angular/common'
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  OnChanges,
  booleanAttribute,
  inject,
  input,
  viewChild
} from '@angular/core'
import { Params, QueryParamsHandling, RouterLink, RouterLinkActive } from '@angular/router'
import { GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import debug from 'debug'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { LoaderComponent } from '../common/loader.component'

const debugLogger = debug('peertube:button')

export type ButtonTheme = 'primary' | 'secondary' | 'tertiary' | 'danger'

@Component({
  selector: 'my-button',
  styleUrls: [ './button.component.scss' ],
  templateUrl: './button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    NgbTooltip,
    NgTemplateOutlet,
    RouterLink,
    LoaderComponent,
    GlobalIconComponent,
    ObserversModule,
    RouterLinkActive
  ]
})
export class ButtonComponent implements OnChanges, AfterViewInit {
  private cd = inject(ChangeDetectorRef)

  readonly label = input('')
  readonly theme = input<ButtonTheme>('secondary')
  readonly icon = input<GlobalIconName>(undefined)

  readonly href = input<string>(undefined)
  readonly ptRouterLink = input<string[] | string>(undefined)
  readonly ptQueryParams = input<Params>(undefined)
  readonly ptQueryParamsHandling = input<QueryParamsHandling>(undefined)
  readonly ptRouterLinkActive = input('')

  readonly title = input<string>(undefined)
  readonly tooltip = input<string>(undefined)
  readonly active = input(false, { transform: booleanAttribute })

  readonly loading = input(false, { transform: booleanAttribute })
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly responsiveLabel = input(false, { transform: booleanAttribute })
  readonly autoFontSize = input(false, { transform: booleanAttribute })
  readonly rounded = input(false, { transform: booleanAttribute })
  readonly small = input(false, { transform: booleanAttribute })
  readonly show = input(false, { transform: booleanAttribute })
  readonly form = input<string>()

  readonly labelContent = viewChild<ElementRef>('labelContent')

  classes: { [id: string]: boolean } = {}

  ngOnChanges () {
    this.buildClasses()
  }

  ngAfterViewInit () {
    this.buildClasses()
  }

  @HostListener('touchend', [ '$event' ])
  onTouchEnd (event: TouchEvent): void {
    if (this.disabled()) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  @HostBinding('style.pointer-events')
  get pointerEvents (): string {
    return this.disabled() ? 'none' : 'auto'
  }

  private buildClasses () {
    const isButtonLink = !!this.ptRouterLink() || !!this.href()
    const label = this.getLabel() || ''

    this.classes = {
      'active': this.active(),
      'peertube-button': !isButtonLink,
      'peertube-button-link': isButtonLink,
      'primary-button': this.theme() === 'primary',
      'secondary-button': this.theme() === 'secondary',
      'tertiary-button': this.theme() === 'tertiary',
      'danger-button': this.theme() === 'danger',
      'has-icon': !!this.icon(),
      'rounded-icon-button': !!this.rounded(),
      'icon-only': !label,
      'label-xl': this.autoFontSize() && label.length > 10,
      'responsive-label': this.responsiveLabel(),
      'small-button': this.small(),
      'show': this.show()
    }

    debugLogger('Built button classes', { classes: this.classes, label, labelContent: this.labelContent() })

    this.cd.markForCheck()
  }

  private getLabel () {
    return this.label() || (this.labelContent()?.nativeElement as HTMLElement)?.innerText
  }
}
