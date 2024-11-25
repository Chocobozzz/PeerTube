import { ObserversModule } from '@angular/cdk/observers'
import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common'
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  ViewChild,
  booleanAttribute
} from '@angular/core'
import { Params, QueryParamsHandling, RouterLink, RouterLinkActive } from '@angular/router'
import { GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import debug from 'debug'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { LoaderComponent } from '../common/loader.component'

const debugLogger = debug('peertube:button')

@Component({
  selector: 'my-button',
  styleUrls: [ './button.component.scss' ],
  templateUrl: './button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgIf,
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
  @Input() label = ''
  @Input() theme: 'primary' | 'secondary' | 'tertiary' = 'secondary'
  @Input() icon: GlobalIconName

  @Input() ptRouterLink: string[] | string
  @Input() ptQueryParams: Params
  @Input() ptQueryParamsHandling: QueryParamsHandling
  @Input() ptRouterLinkActive = ''

  @Input() title: string
  @Input() tooltip: string
  @Input({ transform: booleanAttribute }) active = false

  @Input({ transform: booleanAttribute }) loading = false
  @Input({ transform: booleanAttribute }) disabled = false
  @Input({ transform: booleanAttribute }) responsiveLabel = false
  @Input({ transform: booleanAttribute }) rounded = false

  @ViewChild('labelContent') labelContent: ElementRef

  classes: { [id: string]: boolean } = {}

  constructor (private cd: ChangeDetectorRef) {}

  ngOnChanges () {
    this.buildClasses()
  }

  ngAfterViewInit () {
    this.buildClasses()
  }

  private buildClasses () {
    const isButtonLink = !!this.ptRouterLink

    this.classes = {
      'active': this.active,
      'peertube-button': !isButtonLink,
      'peertube-button-link': isButtonLink,
      'primary-button': this.theme === 'primary',
      'secondary-button': this.theme === 'secondary',
      'tertiary-button': this.theme === 'tertiary',
      'has-icon': !!this.icon,
      'rounded-icon-button': !!this.rounded,
      'icon-only': !this.label && !(this.labelContent?.nativeElement as HTMLElement)?.innerText,
      'responsive-label': this.responsiveLabel
    }

    debugLogger('Built button classes', { classes: this.classes, labelContent: this.labelContent })

    this.cd.markForCheck()
  }
}
