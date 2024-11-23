/*
MIT License

Copyright (c) 2019 Jimmy Wärting
Copyright (c) 2021 Alexandru Ciuca

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const native: typeof globalThis.showDirectoryPicker | undefined = globalThis.showDirectoryPicker

export interface CustomDirectoryPickerOptions extends DirectoryPickerOptions {
  /** If you rather want to use the polyfill instead of the native implementation */
  _preferPolyfill?: boolean
}

export async function showDirectoryPicker (options: CustomDirectoryPickerOptions = {}): Promise<globalThis.FileSystemDirectoryHandle> {
  if (native && !options._preferPolyfill) {
    return native(options)
  }

  const input = document.createElement('input')
  input.type = 'file'

  // @ts-ignore
  input.webkitdirectory = true
  // Fallback to multiple files input for iOS Safari
  input.multiple = true

  // See https://stackoverflow.com/questions/47664777/javascript-file-input-onchange-not-working-ios-safari-only
  input.style.position = 'fixed'
  input.style.top = '-100000px'
  input.style.left = '-100000px'
  document.body.appendChild(input)

  const { makeDirHandleFromFileList } = await import('./util.js')

  return new Promise<FileSystemDirectoryHandle>((resolve, reject) => {
    input.addEventListener('change', () => {
      makeDirHandleFromFileList(input.files!).then(resolve).catch(reject)
      document.body.removeChild(input)
    })
    input.click()
  })
}

export default showDirectoryPicker