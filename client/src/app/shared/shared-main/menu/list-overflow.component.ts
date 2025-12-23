import { NgClass, NgTemplateOutlet, SlicePipe } from '@angular/common'
import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  TemplateRef,
  inject,
  input,
  viewChild,
  viewChildren
} from '@angular/core'
import { ScreenService } from '@app/core'
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { randomInt } from '@peertube/peertube-core-utils'
import debug from 'debug'
import { lowerFirst, uniqueId } from 'lodash-es'

const debugLogger = debug('peertube:main:ListOverflowItem')

export interface ListOverflowItem {
  label: string
  routerLink: string | any[]
  isDisplayed?: () => boolean
}

@Component({
  selector: 'my-list-overflow',
  templateUrl: './list-overflow.component.html',
  styleUrls: [ './list-overflow.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    NgbDropdown,
    NgbDropdownToggle,
    NgClass,
    NgbDropdownMenu,
    SlicePipe
  ]
})
export class ListOverflowComponent<T extends ListOverflowItem> implements OnInit, AfterViewInit {
  private cdr = inject(ChangeDetectorRef)
  private modalService = inject(NgbModal)
  private screenService = inject(ScreenService)

  readonly items = input<T[]>(undefined)
  readonly itemTemplate = input<
    TemplateRef<{
      item: T
      dropdown?: boolean
      modal?: boolean
    }>
  >(undefined)
  readonly hasBorder = input(false, { transform: booleanAttribute })

  readonly modal = viewChild<ElementRef>('modal')
  readonly parent = viewChild<ElementRef<HTMLDivElement>>('itemsParent')
  readonly itemsRendered = viewChildren<ElementRef>('itemsRendered')

  showItemsUntilIndexExcluded: number
  isInMobileView = false
  initialized = false

  private randomInt: number

  ngOnInit () {
    this.randomInt = randomInt(1, 2000)
  }

  ngAfterViewInit () {
    setTimeout(() => {
      this.onWindowResize()
      this.initialized = true
    }, 0)
  }

  isMenuDisplayed () {
    return !!this.showItemsUntilIndexExcluded
  }

  @HostListener('window:resize')
  onWindowResize () {
    this.isInMobileView = !!this.screenService.isInMobileView()

    const parentWidth = this.parent().nativeElement.getBoundingClientRect().width
    let showItemsUntilIndexExcluded: number
    let accWidth = 0

    debugLogger('Parent width is %d', parentWidth)

    for (const [ index, el ] of this.itemsRendered().entries()) {
      accWidth += el.nativeElement.getBoundingClientRect().width

      if (showItemsUntilIndexExcluded === undefined) {
        showItemsUntilIndexExcluded = (parentWidth < accWidth) ? index : undefined
      }
    }

    debugLogger('Accumulated children width is %d so exclude index is %d', accWidth, showItemsUntilIndexExcluded)

    this.showItemsUntilIndexExcluded = showItemsUntilIndexExcluded
    this.cdr.markForCheck()
  }

  toggleModal () {
    this.modalService.open(this.modal(), { centered: true })
  }

  getId (id: number | string = uniqueId()): string {
    return lowerFirst(this.constructor.name) + '_' + this.randomInt + '_' + id
  }
}
