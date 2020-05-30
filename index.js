import { Dropbox } from 'dropbox'

const dbx = new Dropbox({
  accessToken: 'sl.AbAIHZn-vEcPyysCHDQFYyu7g2v48BUriUvFMuFRYOxOzNtxWqbSuuHlmQFESHMUHYCH4N4o61SCWf3UDY4F7zBMx-4GphI_le1M0PQ0Jp4WtEEI6QaX3DK6lqj7PxqPAUq18PwJ',
  fetch
})

const fileListElem = document.querySelector('.js-file-list')
const loadingElem = document.querySelector('.js-loading')
const rootPathForm = document.querySelector('.js-root-path__form')
const rootPathInput = document.querySelector('.js-root-path__input')
const organizeBtn = document.querySelector('.js-organize-btn')

rootPathForm.addEventListener('submit', e => {
  e.preventDefault();
  state.rootPath = rootPathInput.value === '/' ? '' : rootPathInput.value.toLowerCase()
  reset()
})

organizeBtn.addEventListener('click', async e => {
  const originalMsg = e.target.innerHTML
  e.target.disabled = true
  e.target.innerHTML = 'Working...'
  await moveFilesToDatedFolders()
  e.target.disabled = false
  e.target.innerHTML = originalMsg
  reset()
})

const reset = () => {
  state.files = []
  loadingElem.classList.remove('hidden')
  init()
}

const state = {
  files: [],
  rootPath: ''
}

const init = async () => {
  const res = await dbx.filesListFolder({
    path: state.rootPath,
    limit: 20
  })
  updateFiles(res.entries)
  if (res.has_more) {
    loadingElem.classList.remove('hidden')
    await getMoreFiles(res.cursor, more => updateFiles(more.entries))
    loadingElem.classList.add('hidden')
  } else {
    loadingElem.classList.add('hidden')
  }
}

const updateFiles = files => {
  state.files = [...state.files, ...files]
  renderFiles()
  getThumbnails(files)
}

const getMoreFiles = async (cursor, cb) => {
  const res = await dbx.filesListFolderContinue({ cursor })
  if (cb) cb(res)
  if (res.has_more) {
    await getMoreFiles(res.cursor, cb)
  }
}

const renderFiles = () => {
  fileListElem.innerHTML = state.files.sort((a, b) => {
    // sort alphabetically, folders first
    if ((a['.tag'] === 'folder' || b['.tag'] === 'folder')
      && !(a['.tag'] === b['.tag'])) {
      return a['.tag'] === 'folder' ? -1 : 1
    } else {
      return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
    }
  }).map(file => {
    const type = file['.tag']
    let thumbnail
    if (type === 'file') {
      thumbnail = file.thumbnail
      ? `data:image/jpeg;base64, ${file.thumbnail}`
      : `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWZpbGUiPjxwYXRoIGQ9Ik0xMyAySDZhMiAyIDAgMCAwLTIgMnYxNmEyIDIgMCAwIDAgMiAyaDEyYTIgMiAwIDAgMCAyLTJWOXoiPjwvcGF0aD48cG9seWxpbmUgcG9pbnRzPSIxMyAyIDEzIDkgMjAgOSI+PC9wb2x5bGluZT48L3N2Zz4=`
    } else {
      thumbnail = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWZvbGRlciI+PHBhdGggZD0iTTIyIDE5YTIgMiAwIDAgMS0yIDJINGEyIDIgMCAwIDEtMi0yVjVhMiAyIDAgMCAxIDItMmg1bDIgM2g5YTIgMiAwIDAgMSAyIDJ6Ij48L3BhdGg+PC9zdmc+`
    }
    return `
      <li class="dbx-list-item ${type}">
        <img class="dbx-thumb" src="${thumbnail}">
        ${file.name}
      </li>
    `
  }).join('')
}

const getThumbnails = async files => {
  const paths = files.filter(file => file['.tag'] === 'file')
  .map(file => ({
    path: file.path_lower,
    size: 'w32h32'
  }))
  const res = await dbx.filesGetThumbnailBatch({
    entries: paths
  })
  const newStateFiles = [...state.files]
  res.entries.forEach(file => {
    let indexToUpdate = state.files.findIndex(
      stateFile => file.metadata.path_lower === stateFile.path_lower
    )
    newStateFiles[indexToUpdate].thumbnail = file.thumbnail
  })
  state.files = newStateFiles
  renderFiles()
}

const moveFilesToDatedFolders = async () => {
  const entries = state.files
    .filter(file => file['.tag'] === 'file')
    .map(file => {
      const date = new Date(file.client_modified)
      return {
        from_path: file.path_lower,
        to_path: `${state.rootPath}/${date.getFullYear()}/${date.getUTCMonth() + 1}/${file.name}`
      }
    })
  let res = await dbx.filesMoveBatchV2({ entries })
  const { async_job_id } = res
  if (async_job_id) {
    do {
      res = await dbx.filesMoveBatchCheckV2({ async_job_id })
      console.log(res)
    } while (res['.tag'] === 'in_progress')
  }
}

init()
