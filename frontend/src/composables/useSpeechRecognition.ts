import { ref, readonly, onUnmounted } from 'vue'

export interface UseSpeechRecognitionOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  /** final 세그먼트 확정 시마다 호출 (페이지에서 content 에 append) */
  onFinal?: (text: string) => void
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = 'ko-KR',
    continuous = true,
    interimResults = true,
    onFinal,
  } = options

  const Ctor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : undefined
  const isSupported = !!Ctor

  const isRecording = ref(false)
  const interimText = ref('')
  const error = ref('')

  let recognition: SpeechRecognition | null = null
  let manualStop = false // 사용자가 명시적 stop() 했는지 → onend 자동재시작 게이트
  let restartTimer: number | null = null
  let failCount = 0 // 연속 '하드 실패' 카운터 (백오프/중단용)
  const MAX_FAILS = 5
  let hadHardError = false // 이번 세션이 하드 에러(network 등)로 끝났는지 — benign(무음)은 제외
  let endResolvers: Array<() => void> = [] // stop() 의 onend 대기자
  let pendingFlush = '' // 중지 시점에 아직 확정 안 된 중간 텍스트 → 엔진이 final 못 주면 onend 에서 확정 반영

  function clearRestartTimer() {
    if (restartTimer !== null) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  // 세션이 실제 종료(onend)됐을 때 stop() 대기자들을 깨움
  function settleEnd() {
    const rs = endResolvers
    endResolvers = []
    rs.forEach((r) => r())
  }

  function build(): SpeechRecognition | null {
    if (!Ctor) return null
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = continuous
    rec.interimResults = interimResults
    rec.maxAlternatives = 1

    rec.onresult = (event: SpeechRecognitionEvent) => {
      // 실제 인식 성공 시점에만 실패 카운터/에러 회복 (onstart 리셋은 백오프 가드를 무력화하므로 사용 안 함)
      failCount = 0
      if (error.value) error.value = ''
      let interim = ''
      // resultIndex 부터 순회 — 이전 final 중복 삽입 방지
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) {
          const finalText = transcript.trim()
          if (finalText) onFinal?.(finalText) // 확정 → 호출측에서 <p> append
          pendingFlush = '' // 실제 final 이 왔으므로 중지-플러시 불필요(중복 방지)
        } else {
          interim += transcript // 중간 → 미리보기 전용
        }
      }
      interimText.value = interim
    }

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          error.value = '마이크 사용 권한이 거부되었습니다. 브라우저 주소창의 권한 설정을 확인해주세요.'
          manualStop = true // 영구 에러 → 재시작 금지
          isRecording.value = false
          break
        case 'audio-capture':
          error.value = '마이크를 찾을 수 없습니다. 장치 연결을 확인해주세요.'
          manualStop = true
          isRecording.value = false
          break
        case 'language-not-supported':
          error.value = '이 브라우저에서는 한국어 음성 인식이 지원되지 않습니다.'
          manualStop = true
          isRecording.value = false
          break
        case 'network':
          // 하드 실패 → 카운트 대상(onend 에서 백오프/MAX 처리)
          error.value = '음성 인식 서버에 연결할 수 없습니다. 네트워크를 확인해주세요.'
          hadHardError = true
          break
        case 'no-speech':
        case 'aborted':
          // benign(무음/stop) — 카운트 안 함. 회의 중 침묵에도 세션 유지(onend 가 재시작)
          break
        default:
          error.value = '음성 인식 중 오류가 발생했습니다.'
          hadHardError = true
      }
    }

    // 세션 종료 → 사용자가 끈 게 아니면 재시작. 하드 실패만 카운트(무음은 무한 유지)
    rec.onend = () => {
      interimText.value = ''
      if (manualStop) {
        // 엔진이 마지막 중간 텍스트를 final 로 안 줬으면 여기서 확정 반영 (중지 시 유실 방지)
        const leftover = pendingFlush.trim()
        pendingFlush = ''
        if (leftover) onFinal?.(leftover)
        isRecording.value = false
        settleEnd()
        return
      }
      const hard = hadHardError
      hadHardError = false
      if (hard) {
        failCount++
        if (failCount > MAX_FAILS) {
          if (!error.value) error.value = '음성 인식이 반복 실패하여 중지되었습니다. 다시 시도해주세요.'
          isRecording.value = false
          settleEnd()
          return
        }
      }
      // 하드 실패면 백오프(250→2000ms), benign(무음/정상종료)이면 카운트 없이 짧게 재시작
      const delay = hard ? Math.min(250 * 2 ** (failCount - 1), 2000) : 250
      clearRestartTimer()
      restartTimer = window.setTimeout(() => {
        try {
          rec.start()
        } catch {
          isRecording.value = false
        }
      }, delay)
    }

    return rec
  }

  function start() {
    if (!isSupported) {
      error.value = '이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge 를 사용해주세요.'
      return
    }
    if (isRecording.value) return
    // 이전 인스턴스 잔여 이벤트 차단 (빠른 stop→start 레이스로 유령 재시작 방지)
    if (recognition) {
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
    }
    error.value = ''
    manualStop = false
    failCount = 0
    hadHardError = false
    pendingFlush = ''
    recognition = build()
    if (!recognition) return
    try {
      recognition.start()
      isRecording.value = true
    } catch {
      isRecording.value = false
      error.value = '음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.'
    }
  }

  // stop() 은 onend(=마지막 final flush 완료) 시점에 resolve → 저장 전 await 로 마지막 문장 누락 방지
  function stop(): Promise<void> {
    manualStop = true
    pendingFlush = interimText.value // 중지 시점의 미확정 텍스트 보존 → onend 에서 확정 반영
    interimText.value = ''
    clearRestartTimer()
    if (!recognition) {
      isRecording.value = false
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      let done = false
      let safety: number | null = null
      const finish = () => {
        if (done) return
        done = true
        if (safety !== null) clearTimeout(safety)
        resolve()
      }
      endResolvers.push(finish)
      safety = window.setTimeout(finish, 1500) // onend 미발생 대비 안전장치
      try {
        recognition!.stop() // 진행 중 final flush 후 onend
      } catch {
        finish()
      }
      isRecording.value = false
    })
  }

  function toggle() {
    if (isRecording.value) stop()
    else start()
  }

  // 언마운트 / HMR 정리 — 유령 인스턴스 + 마이크 점유 방지
  onUnmounted(() => {
    manualStop = true
    clearRestartTimer()
    if (recognition) {
      recognition.onend = null // 재시작 경로 완전 차단
      try {
        recognition.abort()
      } catch {
        /* ignore */
      }
      recognition = null
    }
    settleEnd() // 대기 중인 stop() Promise 정리 (행 방지)
  })

  return {
    isSupported,
    isRecording: readonly(isRecording),
    interimText: readonly(interimText),
    error: readonly(error),
    start,
    stop,
    toggle,
  }
}
