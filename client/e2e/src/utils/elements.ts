export async function getCheckbox (name: string) {
  const input = $(`my-peertube-checkbox input[id=${name}]`)
  await input.waitForExist()

  return input.parentElement()
}

export function isCheckboxSelected (name: string) {
  return $(`input[id=${name}]`).isSelected()
}

export async function setCheckboxEnabled (name: string, enabled: boolean) {
  if (await isCheckboxSelected(name) === enabled) return

  const checkbox = await getCheckbox(name)

  await checkbox.waitForClickable()
  await checkbox.click()
}

// ---------------------------------------------------------------------------

export async function isRadioSelected (name: string) {
  await $(`input[id=${name}] + label`).waitForClickable()

  return $(`input[id=${name}]`).isSelected()
}

export async function clickOnRadio (name: string) {
  const label = $(`input[id=${name}] + label`)

  await label.waitForClickable()
  await label.click()
}

// ---------------------------------------------------------------------------

export async function selectCustomSelect (id: string, valueLabel: string) {
  const wrapper = $(`[formcontrolname=${id}] span[role=combobox]`)

  await wrapper.waitForClickable()
  await wrapper.click()

  const option = await $$(`[formcontrolname=${id}] li[role=option]`).filter(async o => {
    const text = await o.getText()

    return text.trimStart().startsWith(valueLabel)
  }).then(options => options[0])

  await option.waitForDisplayed()

  return option.click()
}

export async function findParentElement (
  el: WebdriverIO.Element,
  finder: (el: WebdriverIO.Element) => Promise<boolean>
) {
  if (await finder(el) === true) return el

  return findParentElement(await el.parentElement(), finder)
}
