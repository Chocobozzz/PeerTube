export interface RegisterClientRouteOptions {
  route: string

  // Plugin route can be injected in a sub router, like the my-account page
  parentRoute?: '/' | '/my-account'
  // If parent route has a sub menu, specify the new entry sub menu settings
  menuItem?: {
    label?: string
  }

  title?: string

  onMount (options: {
    rootEl: HTMLElement
  }): void
}
