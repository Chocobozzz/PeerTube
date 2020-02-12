import {
  Component,
  Input,
  TemplateRef,
  ViewChildren,
  ViewChild,
  QueryList,
  ChangeDetectionStrategy,
  ElementRef,
  ChangeDetectorRef,
  HostListener
} from '@angular/core'
import { NgbModal, NgbDropdown } from '@ng-bootstrap/ng-bootstrap'
import { uniqueId, lowerFirst } from 'lodash-es'
import { ScreenService } from './screen.service'
import { take } from 'rxjs/operators'

export interface ListOverflowItem {
  label: string
  routerLink: string | any[]
}

@Component({
  selector: 'list-overflow',
  templateUrl: './list-overflow.component.html',
  styleUrls: [ './list-overflow.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListOverflowComponent<T extends ListOverflowItem> {
  @ViewChild('modal', { static: true }) modal: ElementRef
  @ViewChild('itemsParent', { static: true }) parent: ElementRef<HTMLDivElement>
  @ViewChildren('itemsRendered') itemsRendered: QueryList<ElementRef>
  @Input() items: T[]
  @Input() itemTemplate: TemplateRef<{item: T}>

  showItemsUntilIndexExcluded: number
  active = false
  isInTouchScreen = false
  isInMobileView = false

  private openedOnHover = false

  constructor (
    private cdr: ChangeDetectorRef,
    private modalService: NgbModal,
    private screenService: ScreenService
  ) {}

  isMenuDisplayed () {
    return !!this.showItemsUntilIndexExcluded
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize () {
    this.isInTouchScreen = !!this.screenService.isInTouchScreen()
    this.isInMobileView = !!this.screenService.isInMobileView()

    const parentWidth = this.parent.nativeElement.getBoundingClientRect().width
    let showItemsUntilIndexExcluded: number
    let accWidth = 0

    for (const [index, el] of this.itemsRendered.toArray().entries()) {
      accWidth += el.nativeElement.getBoundingClientRect().width
      if (showItemsUntilIndexExcluded === undefined) {
        showItemsUntilIndexExcluded = (parentWidth < accWidth) ? index : undefined
      }

      const e = document.getElementById(this.getId(index))
      const shouldBeVisible = showItemsUntilIndexExcluded ? index < showItemsUntilIndexExcluded : true
      e.style.visibility = shouldBeVisible ? 'inherit' : 'hidden'
    }

    this.showItemsUntilIndexExcluded = showItemsUntilIndexExcluded
    this.cdr.markForCheck()
  }

  openDropdownOnHover (dropdown: NgbDropdown) {
    this.openedOnHover = true
    dropdown.open()

    // Menu was closed
    dropdown.openChange
            .pipe(take(1))
            .subscribe(() => this.openedOnHover = false)
  }

  dropdownAnchorClicked (dropdown: NgbDropdown) {
    if (this.openedOnHover) {
      this.openedOnHover = false
      return
    }

    return dropdown.toggle()
  }

  closeDropdownIfHovered (dropdown: NgbDropdown) {
    if (this.openedOnHover === false) return

    dropdown.close()
    this.openedOnHover = false
  }

  toggleModal () {
    this.modalService.open(this.modal, { centered: true })
  }

  dismissOtherModals () {
    this.modalService.dismissAll()
  }

  getId (id: number | string = uniqueId()): string {
    return lowerFirst(this.constructor.name) + '_' + id
  }
}
