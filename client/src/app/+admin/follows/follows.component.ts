import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { TabsetComponent } from 'ngx-bootstrap/tabs'

@Component({
  templateUrl: './follows.component.html',
  styleUrls: [ './follows.component.scss' ]
})
export class FollowsComponent implements OnInit, AfterViewInit {
  @ViewChild('followsMenuTabs') followsMenuTabs: TabsetComponent

  links = [
    {
      path: 'following-list',
      title: 'Following'
    },
    {
      path: 'following-add',
      title: 'Follow'
    },
    {
      path: 'followers-list',
      title: 'Followers'
    }
  ]

  constructor (private router: Router) {}

  ngOnInit () {
    this.router.events.subscribe(
      event => {
        if (event instanceof NavigationEnd) {
          this.updateActiveTab()
        }
      }
    )
  }

  ngAfterViewInit () {
    // Avoid issue with change detector
    setTimeout(() => this.updateActiveTab())
  }

  private updateActiveTab () {
    const url = window.location.pathname

    for (let i = 0; i < this.links.length; i++) {
      const path = this.links[i].path

      if (url.endsWith(path) === true && this.followsMenuTabs.tabs[i]) {
        this.followsMenuTabs.tabs[i].active = true
        return
      }
    }
  }
}
