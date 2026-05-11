<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { ClipboardImagePaste } from '../extensions/clipboardImagePaste'
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  editable?: boolean
}>(), {
  editable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showColorPicker = ref(false)
const showHighlightPicker = ref(false)

const colorPresets = [
  '#000000', '#e81123', '#0078D4', '#107c10', '#ff8c00',
  '#5c2d91', '#b4009e', '#744da9', '#8e562e', '#666666',
]

const highlightPresets = [
  '#ffff00', '#00ff00', '#00ffff', '#ff69b4', '#ffa500',
  '#dda0dd', '#87ceeb', '#f0e68c', '#d3d3d3', '',
]

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
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

watch(
  () => props.editable,
  (val) => {
    if (editor.value) {
      editor.value.setEditable(val)
    }
  }
)

function setColor(color: string) {
  if (!editor.value) return
  editor.value.chain().focus().setColor(color).run()
  showColorPicker.value = false
}

function unsetColor() {
  if (!editor.value) return
  editor.value.chain().focus().unsetColor().run()
  showColorPicker.value = false
}

function setHighlight(color: string) {
  if (!editor.value) return
  if (!color) {
    editor.value.chain().focus().unsetHighlight().run()
  } else {
    editor.value.chain().focus().toggleHighlight({ color }).run()
  }
  showHighlightPicker.value = false
}

function closePickersOnOutside() {
  showColorPicker.value = false
  showHighlightPicker.value = false
}
</script>

<template>
  <div class="rich-editor" :class="{ 'rich-editor--readonly': !editable }" @click="closePickersOnOutside">
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

      <!-- 글자 색 -->
      <div class="rich-editor__color-wrap" @click.stop>
        <button
          type="button"
          class="rich-editor__color-btn"
          :class="{ active: editor.isActive('textStyle') }"
          @click="showColorPicker = !showColorPicker; showHighlightPicker = false"
        >
          <span class="rich-editor__color-icon">A</span>
          <span class="rich-editor__color-bar" :style="{ backgroundColor: editor.getAttributes('textStyle').color || '#000' }"></span>
        </button>
        <div v-if="showColorPicker" class="rich-editor__color-panel">
          <div class="rich-editor__color-grid">
            <button
              v-for="c in colorPresets"
              :key="c"
              class="rich-editor__color-swatch"
              :style="{ backgroundColor: c }"
              @click="setColor(c)"
            ></button>
          </div>
          <button class="rich-editor__color-reset" @click="unsetColor">색 제거</button>
        </div>
      </div>

      <!-- 배경 음영 -->
      <div class="rich-editor__color-wrap" @click.stop>
        <button
          type="button"
          class="rich-editor__color-btn"
          :class="{ active: editor.isActive('highlight') }"
          @click="showHighlightPicker = !showHighlightPicker; showColorPicker = false"
        >
          <span class="rich-editor__highlight-icon">H</span>
          <span class="rich-editor__color-bar" :style="{ backgroundColor: editor.getAttributes('highlight').color || '#ffff00' }"></span>
        </button>
        <div v-if="showHighlightPicker" class="rich-editor__color-panel">
          <div class="rich-editor__color-grid">
            <button
              v-for="c in highlightPresets"
              :key="c || 'none'"
              class="rich-editor__color-swatch"
              :class="{ 'rich-editor__color-swatch--none': !c }"
              :style="c ? { backgroundColor: c } : {}"
              @click="setHighlight(c)"
            >
              <span v-if="!c">✕</span>
            </button>
          </div>
        </div>
      </div>

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

/* 글자색/배경색 버튼 */
.rich-editor__color-wrap {
  position: relative;
  display: inline-block;
}

.rich-editor__color-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 8px !important;
  min-height: 32px !important;
  gap: 1px;
}

.rich-editor__color-icon {
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.rich-editor__highlight-icon {
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  background: #ffff00;
  padding: 0 3px;
}

.rich-editor__color-bar {
  display: block;
  width: 16px;
  height: 3px;
  border-radius: 1px;
}

.rich-editor__color-panel {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid var(--metro-border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 8px;
  z-index: 200;
  min-width: 140px;
}

.rich-editor__color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-bottom: 6px;
}

.rich-editor__color-swatch {
  width: 24px;
  height: 24px;
  border: 1px solid #ccc;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.rich-editor__color-swatch:hover {
  border-color: #333;
  transform: scale(1.1);
}

.rich-editor__color-swatch--none {
  background: #fff;
  color: #999;
}

.rich-editor__color-reset {
  width: 100%;
  padding: 4px;
  font-size: 11px;
  border: 1px solid var(--metro-border);
  background: #f5f5f5;
  cursor: pointer;
  text-align: center;
}

.rich-editor__color-reset:hover {
  background: #e0e0e0;
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

.rich-editor--readonly {
  opacity: 0.6;
  pointer-events: none;
}

.rich-editor__content :deep(.rich-editor-image) {
  max-width: 100%;
  height: auto;
  border: 1px solid var(--metro-border);
  border-radius: 2px;
  margin: 8px 0;
}

/* blob: URL 이미지는 업로드 중 — 반투명 + 로딩 표시 */
.rich-editor__content :deep(img[src^="blob:"]) {
  opacity: 0.5;
  outline: 2px dashed var(--metro-blue);
}
</style>
