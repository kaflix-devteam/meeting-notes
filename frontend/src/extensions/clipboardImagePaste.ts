import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { uploadImage } from '../api'

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
            const imageItem = items.find(
              (item) => item.type.startsWith('image/')
            )

            if (!imageItem) return false

            const file = imageItem.getAsFile()
            if (!file) return false

            event.preventDefault()

            uploadImage(file)
              .then((res) => {
                editor
                  .chain()
                  .focus()
                  .setImage({ src: res.data.url })
                  .run()
              })
              .catch((err) => {
                console.error('[ClipboardImagePaste] Upload failed:', err)
              })

            return true
          },
        },
      }),
    ]
  },
})
