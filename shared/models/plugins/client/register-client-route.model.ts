export interface RegisterClientRouteOptions {
  route: string

  onMount (options: {
    rootEl: HTMLElement
  }): void
}
