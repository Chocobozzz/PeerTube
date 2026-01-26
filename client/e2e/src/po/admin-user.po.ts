export class AdminUserPage {
  async createUser (options: {
    username: string
    password: string
  }) {
    const { username, password } = options

    await $('.menu-link[title=Overview]').click()
    await $('a*=Create user').click()

    await $('#username').waitForDisplayed()
    await $('#username').setValue(username)
    await $('#password').setValue(password)
    await $('#channelName').setValue(`${username}_channel`)
    await $('#email').setValue(`${username}@example.com`)

    const submit = $('my-user-create .primary-button')
    await submit.scrollIntoView()
    await submit.waitForClickable()
    await submit.click()

    await $('.cell-username*=' + username).waitForDisplayed()
  }
}
