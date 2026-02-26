<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { ClipboardImagePaste } from '../extensions/clipboardImagePaste'
import { watch } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: 'rich-editor-image',
      },
    }),
    ClipboardImagePaste,
  ],
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML())
  },
})

watch(
  () => props.modelValue,
  (val) => {
    if (editor.value && editor.value.getHTML() !== val) {
      editor.value.commands.setContent(val, { emitUpdate: false })
    }
  }
)
</script>

<template>
  <div class="rich-editor">
    <div v-if="editor" class="rich-editor__toolbar">
      <button
        type="button"
        :class="{ active: editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()"
      >
        B
      </button>
      <button
        type="button"
        :class="{ active: editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        I
      </button>
      <button
        type="button"
        :class="{ active: editor.isActive('strike') }"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        S
      </button>
      <span class="rich-editor__divider"></span>
      <button
        type="button"
        :class="{ active: editor.isActive('heading', { level: 2 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        H2
      </button>
      <button
        type="button"
        :class="{ active: editor.isActive('heading', { level: 3 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      >
        H3
      </button>
      <span class="rich-editor__divider"></span>
      <button
        type="button"
        :class="{ active: editor.isActive('bulletList') }"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        UL
      </button>
      <button
        type="button"
        :class="{ active: editor.isActive('orderedList') }"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        OL
      </button>
      <span class="rich-editor__divider"></span>
      <button
        type="button"
        :class="{ active: editor.isActive('blockquote') }"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >
        Quote
      </button>
      <button
        type="button"
        @click="editor.chain().focus().setHorizontalRule().run()"
      >
        HR
      </button>
    </div>
    <EditorContent :editor="editor" class="rich-editor__content" />
  </div>
</template>

<style scoped>
.rich-editor {
  border: 2px solid var(--metro-border);
  background: var(--metro-white);
}

.rich-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--metro-border);
  flex-wrap: wrap;
}

.rich-editor__toolbar button {
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  color: var(--metro-text);
  min-height: 32px;
  transition: background-color 0.15s;
}

.rich-editor__toolbar button:hover {
  background-color: var(--metro-hover);
}

.rich-editor__toolbar button.active {
  background-color: var(--metro-blue);
  color: #fff;
}

.rich-editor__divider {
  width: 1px;
  height: 24px;
  background: var(--metro-border);
  margin: 0 4px;
}

.rich-editor__content {
  min-height: 300px;
  padding: 16px;
}

.rich-editor__content :deep(.tiptap) {
  outline: none;
  min-height: 280px;
  font-size: 14px;
  line-height: 1.6;
}

.rich-editor__content :deep(.tiptap h2) {
  font-size: 20px;
  margin: 16px 0 8px;
}

.rich-editor__content :deep(.tiptap h3) {
  font-size: 16px;
  margin: 12px 0 6px;
}

.rich-editor__content :deep(.tiptap p) {
  margin: 0 0 8px;
}

.rich-editor__content :deep(.tiptap ul),
.rich-editor__content :deep(.tiptap ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.rich-editor__content :deep(.tiptap blockquote) {
  border-left: 3px solid var(--metro-blue);
  padding-left: 16px;
  margin: 8px 0;
  color: var(--metro-text-light);
}

.rich-editor__content :deep(.tiptap hr) {
  border: none;
  border-top: 1px solid var(--metro-border);
  margin: 16px 0;
}

.rich-editor__content :deep(.rich-editor-image) {
  max-width: 100%;
  height: auto;
  border: 1px solid var(--metro-border);
  border-radius: 2px;
  margin: 8px 0;
}
</style>
