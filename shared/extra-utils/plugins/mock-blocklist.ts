import * as express from 'express'

type BlocklistResponse = {
  data: {
    value: string
    action?: 'add' | 'remove'
    updatedAt?: string
  }[]
}

export class MockBlocklist {
  private body: BlocklistResponse

  initialize () {
    return new Promise(res => {
      const app = express()

      app.get('/blocklist', (req: express.Request, res: express.Response) => {
        return res.json(this.body)
      })

      app.listen(42100, () => res())
    })
  }

  replace (body: BlocklistResponse) {
    this.body = body
  }
}
