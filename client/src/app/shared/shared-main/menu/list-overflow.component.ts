import { NgClass, NgTemplateOutlet, SlicePipe } from '@angular/common'
import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnInit,
  QueryList,
  TemplateRef,
  ViewChild,
  ViewChildren
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
  standalone: true,
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
  @Input() items: T[]
  @Input() itemTemplate: TemplateRef<{ item: T, dropdown?: boolean, modal?: boolean }>
  @Input({ transform: booleanAttribute }) hasBorder = false

  @ViewChild('modal', { static: true }) modal: ElementRef
  @ViewChild('itemsParent', { static: true }) parent: ElementRef<HTMLDivElement>
  @ViewChildren('itemsRendered') itemsRendered: QueryList<ElementRef>

  showItemsUntilIndexExcluded: number
  isInMobileView = false
  initialized = false

  private randomInt: number

  constructor (
    private cdr: ChangeDetectorRef,
    private modalService: NgbModal,
    private screenService: ScreenService
  ) {}

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

    const parentWidth = this.parent.nativeElement.getBoundingClientRect().width
    let showItemsUntilIndexExcluded: number
    let accWidth = 0

    debugLogger('Parent width is %d', parentWidth)

    for (const [ index, el ] of this.itemsRendered.toArray().entries()) {
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
    this.modalService.open(this.modal, { centered: true })
  }

  getId (id: number | string = uniqueId()): string {
    return lowerFirst(this.constructor.name) + '_' + this.randomInt + '_' + id
  }
}
