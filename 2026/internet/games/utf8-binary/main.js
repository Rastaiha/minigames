import '@fontsource-variable/vazirmatn'
import './style.css'
import { decodeUtf8Binary } from './utf8.js'

const input = document.querySelector('#binary-input')
const output = document.querySelector('#text-output')
const button = document.querySelector('#decode-button')
const outputPanel = document.querySelector('.output-panel')

function render() {
  const result = decodeUtf8Binary(input.value)

  output.value = result.text
  output.textContent = result.text
  outputPanel.classList.toggle('has-error', !result.ok)
  button.classList.remove('pulse')

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(() => button.classList.add('pulse'))
  }
}

input.addEventListener('input', render)
button.addEventListener('click', () => {
  render()
  input.focus()
})

render()
