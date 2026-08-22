
export type ClientRouter = {
  navigateByUrl: (url: string) => Promise<boolean>
}