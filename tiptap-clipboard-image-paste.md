# Tiptap 클립보드 이미지 붙여넣기 구현 가이드

Vue 3 + Tiptap + Express + Multer 기반으로 에디터에서 Ctrl+V(Cmd+V)로 이미지를 붙여넣으면 서버에 업로드 후 `<img>` 태그로 삽입하는 기능.

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Vue 3, TypeScript, Tiptap, Axios |
| Backend | Node.js, Express, TypeScript, Multer |

## 구조

```
frontend/
├── src/
│   ├── api/index.ts                      # uploadImage() API 함수
│   ├── extensions/clipboardImagePaste.ts  # Tiptap 커스텀 확장
│   └── components/RichEditor.vue          # 에디터 컴포넌트

backend/
├── src/
│   ├── middleware/imageUpload.ts          # 이미지 전용 Multer 미들웨어
│   ├── controllers/imageController.ts     # 업로드 컨트롤러
│   └── routes/images.ts                   # POST /api/images 라우트
├── uploads/                               # 이미지 저장 디렉토리
```

## 패키지 설치

```bash
# Frontend
cd frontend
npm install @tiptap/extension-image

# Backend (이미 설치되어 있다면 생략)
cd backend
npm install multer uuid
npm install -D @types/multer @types/uuid
```

---

## 1. Backend: 이미지 업로드 미들웨어

`backend/src/middleware/imageUpload.ts`

```typescript
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const storedName = `${uuidv4()}${ext}`;
    cb(null, storedName);
  },
});

const imageFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Image type not allowed: ${file.mimetype}`));
  }
};

const imageUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export default imageUpload;
```

## 2. Backend: 이미지 업로드 컨트롤러

`backend/src/controllers/imageController.ts`

```typescript
import { Request, Response } from 'express';

export async function uploadImage(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No image file uploaded' });
      return;
    }

    const url = `/uploads/${file.filename}`;

    res.status(201).json({
      url,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  } catch (error) {
    console.error('[imageController] uploadImage error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
}
```

## 3. Backend: 라우트 등록

`backend/src/routes/images.ts`

```typescript
import { Router } from 'express';
import { uploadImage } from '../controllers/imageController';
import imageUpload from '../middleware/imageUpload';

const router = Router();

router.post('/', imageUpload.single('image'), uploadImage);

export default router;
```

`app.ts`에 라우트 추가:

```typescript
import imagesRouter from './routes/images';

// 업로드 파일 정적 서빙 (이미 있다면 생략)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 이미지 업로드 API
app.use('/api/images', imagesRouter);
```

---

## 4. Frontend: API 함수

`frontend/src/api/index.ts`에 추가:

```typescript
export function uploadImage(file: File | Blob) {
  const formData = new FormData()
  if (file instanceof Blob && !(file instanceof File)) {
    formData.append('image', file, 'pasted-image.png')
  } else {
    formData.append('image', file)
  }
  return api.post<{ url: string }>('/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
```

> 클립보드에서 가져온 이미지는 `File`이 아닌 `Blob`이므로, `FormData.append`에 파일명을 명시해야 multer가 확장자를 인식합니다.

## 5. Frontend: 클립보드 이미지 붙여넣기 확장

`frontend/src/extensions/clipboardImagePaste.ts`

```typescript
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

            // 이미지가 없으면 기본 paste 동작 유지
            if (!imageItem) return false

            const file = imageItem.getAsFile()
            if (!file) return false

            event.preventDefault()

            // 비동기 업로드 후 에디터에 이미지 삽입
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
```

### 동작 원리

1. `handlePaste`에서 클립보드 데이터를 확인
2. `image/*` 타입 항목이 있으면 `getAsFile()`로 파일 추출
3. `event.preventDefault()`로 기본 붙여넣기 차단
4. 서버에 업로드 후 반환된 URL로 `setImage` 커맨드 실행
5. `return true`로 ProseMirror에 이벤트 처리 완료 알림
6. 텍스트만 붙여넣기하면 `return false`로 기본 동작 유지

## 6. Frontend: 에디터에 확장 등록

`RichEditor.vue`의 `<script setup>`:

```typescript
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { ClipboardImagePaste } from '../extensions/clipboardImagePaste'

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Image.configure({
      inline: false,       // 블록 레벨 이미지
      allowBase64: false,  // base64 임베딩 차단 (서버 업로드만 허용)
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
```

이미지 CSS:

```css
.rich-editor__content :deep(.rich-editor-image) {
  max-width: 100%;
  height: auto;
  border: 1px solid #e0e0e0;
  border-radius: 2px;
  margin: 8px 0;
}
```

---

## Vite 개발 서버 프록시 설정

개발 모드에서 프론트(5173)와 백엔드(3000)가 별도 포트일 때 `vite.config.ts`에 프록시 추가:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

---

## 저장 결과

보고서 저장 시 `content_html`에 아래와 같은 형태로 이미지가 포함됨:

```html
<p>보고서 내용...</p>
<img src="/uploads/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png" class="rich-editor-image">
<p>이미지 아래 내용...</p>
```

## 체크리스트

- [ ] `uploads/` 디렉토리 생성 확인
- [ ] Express에 `/uploads` 정적 서빙 등록
- [ ] `@tiptap/extension-image` 패키지 설치
- [ ] 이미지 업로드 API (`POST /api/images`) 등록
- [ ] `ClipboardImagePaste` 확장을 에디터에 등록
- [ ] Vite 프록시에 `/api`, `/uploads` 추가 (개발 모드)
- [ ] `.gitignore`에 `uploads/` 추가
