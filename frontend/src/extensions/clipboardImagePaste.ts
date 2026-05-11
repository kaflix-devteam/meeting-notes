import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { uploadImage } from '../api'

// 업로드 진행 중인 개수 추적
let pendingUploads = 0

/**
 * 현재 업로드 진행 중인 이미지가 있는지 확인
 */
export function hasPendingUploads(): boolean {
  return pendingUploads > 0
}

/**
 * 모든 업로드가 완료될 때까지 대기 (최대 30초)
 */
export function waitForUploads(timeoutMs = 30000): Promise<void> {
  return new Promise((resolve) => {
    if (pendingUploads <= 0) { resolve(); return }
    const start = Date.now()
    const check = setInterval(() => {
      if (pendingUploads <= 0 || Date.now() - start > timeoutMs) {
        clearInterval(check)
        resolve()
      }
    }, 200)
  })
}

function handleImageFile(file: File, editor: any) {
  // 임시 Object URL 생성 → 즉시 미리보기 삽입
  const tempUrl = URL.createObjectURL(file)
  editor
    .chain()
    .focus()
    .setImage({ src: tempUrl })
    .run()

  pendingUploads++

  // 서버 업로드 → 완료 후 DOM에서 해당 img의 src만 교체
  uploadImage(file)
    .then((res) => {
      const serverUrl = res.data.url
      // ProseMirror state에서 src 교체
      const tr = editor.view.state.tr
      editor.view.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'image' && node.attrs.src === tempUrl) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: serverUrl })
        }
      })
      if (tr.docChanged) {
        editor.view.dispatch(tr)
      }
      URL.revokeObjectURL(tempUrl)
    })
    .catch((err) => {
      console.error('[ClipboardImagePaste] Upload failed:', err)
      // 업로드 실패 시 해당 이미지만 제거
      const tr = editor.view.state.tr
      const positions: number[] = []
      editor.view.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'image' && node.attrs.src === tempUrl) {
          positions.push(pos)
        }
      })
      for (const pos of positions.reverse()) {
        tr.delete(pos, pos + 1)
      }
      if (tr.docChanged) {
        editor.view.dispatch(tr)
      }
      URL.revokeObjectURL(tempUrl)
    })
    .finally(() => {
      pendingUploads--
    })
}

export const ClipboardImagePaste = Extension.create({
  name: 'clipboardImagePaste',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        key: new PluginKey('clipboardImagePaste'),
        props: {
          handlePaste(_view, event, _slice) {
            const clipboardData = event.clipboardData
            if (!clipboardData) return false

            const items = Array.from(clipboardData.items)
            const imageItem = items.find((item) => item.type.startsWith('image/'))

            if (imageItem) {
              const file = imageItem.getAsFile()
              if (file) {
                event.preventDefault()
                handleImageFile(file, editor)
                return true
              }
            }

            const files = Array.from(clipboardData.files)
            const imageFile = files.find((f) => f.type.startsWith('image/'))

            if (imageFile) {
              event.preventDefault()
              handleImageFile(imageFile, editor)
              return true
            }

            const html = clipboardData.getData('text/html')
            if (html) {
              const imgMatch = html.match(/<img[^>]+src="([^"]+)"/)
              if (imgMatch && imgMatch[1]) {
                const imgSrc = imgMatch[1]

                if (imgSrc.startsWith('data:image')) {
                  event.preventDefault()
                  fetch(imgSrc)
                    .then((res) => res.blob())
                    .then((blob) => {
                      const f = new File([blob], 'pasted-image.png', { type: blob.type || 'image/png' })
                      handleImageFile(f, editor)
                    })
                    .catch(() => {})
                  return true
                }

                if (imgSrc.startsWith('http')) {
                  event.preventDefault()
                  editor.chain().focus().setImage({ src: imgSrc }).run()
                  return true
                }
              }
            }

            return false
          },

          handleDrop(_view, event, _slice, moved) {
            if (moved) return false

            const dataTransfer = event.dataTransfer
            if (!dataTransfer) return false

            const files = Array.from(dataTransfer.files)
            const imageFile = files.find((f) => f.type.startsWith('image/'))

            if (!imageFile) return false

            event.preventDefault()
            handleImageFile(imageFile, editor)
            return true
          },
        },
      }),
    ]
  },
})
