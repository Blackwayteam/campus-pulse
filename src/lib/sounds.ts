let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      if (!AC) return null
      audioCtx = new AC()
    }
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
  } catch (e) { return null }
}

export function playSound(status: string) {
  const ctx = getCtx()
  if (!ctx) return
  try {
    switch (status) {
      case 'cancelled': bigExplosion(ctx); break
      case 'confirmed': rainChime(ctx); break
      case 'delayed':   warningBeep(ctx); break
      case 'pending':   tensionDrone(ctx); break
      case 'broadcast': broadcastFanfare(ctx); break
      case 'warning':   bigExplosion(ctx); break
    }
  } catch (e) { console.warn('Sound error:', e) }
}

export function playReactionSound(emoji: string) {
  const ctx = getCtx()
  if (!ctx) return
  try {
    switch (emoji) {
      case '🔥': fireCrackle(ctx); break
      case '😂': laughSound(ctx); break
      case '😭': crySound(ctx); break
      case '⚡': zapSound(ctx); break
      case '☕': warmTone(ctx); break
      case '🎉': popSound(ctx); break
    }
  } catch (e) { console.warn('Reaction sound error:', e) }
}

// 🔥 BUSUUSH BUUSH — Big explosion for cancelled
function bigExplosion(ctx: AudioContext) {
  const now = ctx.currentTime
  const bufferSize = Math.floor(ctx.sampleRate * 1.5)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  // FIRST BLAST — BUSUUSH
  const noise1 = ctx.createBufferSource()
  noise1.buffer = buffer
  const filter1 = ctx.createBiquadFilter()
  filter1.type = 'lowpass'
  filter1.frequency.value = 600
  const gain1 = ctx.createGain()
  noise1.connect(filter1); filter1.connect(gain1); gain1.connect(ctx.destination)
  gain1.gain.setValueAtTime(0.001, now)
  gain1.gain.exponentialRampToValueAtTime(4.0, now + 0.02)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
  noise1.start(now); noise1.stop(now + 0.55)

  // Bass thud 1
  const bass1 = ctx.createOscillator()
  const bGain1 = ctx.createGain()
  bass1.connect(bGain1); bGain1.connect(ctx.destination)
  bass1.type = 'sine'
  bass1.frequency.setValueAtTime(120, now)
  bass1.frequency.exponentialRampToValueAtTime(25, now + 0.45)
  bGain1.gain.setValueAtTime(4.0, now)
  bGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
  bass1.start(now); bass1.stop(now + 0.45)

  // SECOND BLAST — BUUSH
  const noise2 = ctx.createBufferSource()
  noise2.buffer = buffer
  const filter2 = ctx.createBiquadFilter()
  filter2.type = 'lowpass'
  filter2.frequency.value = 400
  const gain2 = ctx.createGain()
  noise2.connect(filter2); filter2.connect(gain2); gain2.connect(ctx.destination)
  gain2.gain.setValueAtTime(0.001, now + 0.6)
  gain2.gain.exponentialRampToValueAtTime(2.5, now + 0.63)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.0)
  noise2.start(now + 0.6); noise2.stop(now + 1.05)

  // Bass thud 2
  const bass2 = ctx.createOscillator()
  const bGain2 = ctx.createGain()
  bass2.connect(bGain2); bGain2.connect(ctx.destination)
  bass2.type = 'sine'
  bass2.frequency.setValueAtTime(90, now + 0.6)
  bass2.frequency.exponentialRampToValueAtTime(20, now + 0.95)
  bGain2.gain.setValueAtTime(3.0, now + 0.6)
  bGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.95)
  bass2.start(now + 0.6); bass2.stop(now + 1.0)

  // Crackle layer
  for (let i = 0; i < 10; i++) {
    const crackle = ctx.createBufferSource()
    crackle.buffer = buffer
    const cGain = ctx.createGain()
    const cFilter = ctx.createBiquadFilter()
    cFilter.type = 'bandpass'
    cFilter.frequency.value = 600 + Math.random() * 2000
    crackle.connect(cFilter); cFilter.connect(cGain); cGain.connect(ctx.destination)
    const t = now + 0.05 + Math.random() * 0.9
    cGain.gain.setValueAtTime(0.4 + Math.random() * 0.4, t)
    cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    crackle.start(t); crackle.stop(t + 0.07)
  }
}

// 🔥 Fire crackle — reaction
function fireCrackle(ctx: AudioContext) {
  const now = ctx.currentTime
  const bufferSize = Math.floor(ctx.sampleRate * 0.15)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  for (let i = 0; i < 3; i++) {
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 800 + Math.random() * 600
    const gain = ctx.createGain()
    noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
    const t = now + i * 0.07
    gain.gain.setValueAtTime(1.0, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    noise.start(t); noise.stop(t + 0.07)
  }
}

// 😂 Laugh — bouncy ascending
function laughSound(ctx: AudioContext) {
  const freqs = [380, 480, 430, 530, 480, 580]
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    const t = ctx.currentTime + i * 0.055
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    osc.start(t); osc.stop(t + 0.06)
  })
}

// 😭 Cry — sad descending with wobble
function crySound(ctx: AudioContext) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency)
  osc.connect(gain); gain.connect(ctx.destination)
  lfo.frequency.value = 7
  lfoGain.gain.value = 25
  osc.type = 'sine'
  osc.frequency.setValueAtTime(520, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.5)
  gain.gain.setValueAtTime(0.35, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55)
  lfo.start(ctx.currentTime); osc.start(ctx.currentTime)
  lfo.stop(ctx.currentTime + 0.55); osc.stop(ctx.currentTime + 0.55)
}

// ⚡ Electric zap
function zapSound(ctx: AudioContext) {
  const now = ctx.currentTime
  const bufferSize = Math.floor(ctx.sampleRate * 0.12)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 3500
  const gain = ctx.createGain()
  noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
  gain.gain.setValueAtTime(2.0, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  noise.start(now); noise.stop(now + 0.12)
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.connect(oscGain); oscGain.connect(ctx.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(2200, now)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.1)
  oscGain.gain.setValueAtTime(0.4, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  osc.start(now); osc.stop(now + 0.1)
}

// ☕ Warm soft tone
function warmTone(ctx: AudioContext) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.value = 220
  gain.gain.setValueAtTime(0.001, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
}

// 🎉 Pop and sparkle
function popSound(ctx: AudioContext) {
  const now = ctx.currentTime
  const bufferSize = Math.floor(ctx.sampleRate * 0.04)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const gain = ctx.createGain()
  noise.connect(gain); gain.connect(ctx.destination)
  gain.gain.setValueAtTime(2.0, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
  noise.start(now); noise.stop(now + 0.04)
  const sparkle = [1047, 1319, 1568, 2093]
  sparkle.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = now + 0.04 + i * 0.07
    g.gain.setValueAtTime(0.25, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.start(t); osc.stop(t + 0.2)
  })
}

// Rain chime — confirmed
function rainChime(ctx: AudioContext) {
  const freqs = [523, 659, 784, 1047, 1319]
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    const t = ctx.currentTime + i * 0.14
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.35, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
    osc.start(t); osc.stop(t + 1.2)
  })
}

// Warning beep — delayed
function warningBeep(ctx: AudioContext) {
  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    const t = ctx.currentTime + i * 0.35
    osc.type = 'square'
    osc.frequency.value = 700
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    osc.start(t); osc.stop(t + 0.25)
  }
}

// Tension drone — pending
function tensionDrone(ctx: AudioContext) {
  for (let i = 0; i < 4; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    const t = ctx.currentTime + i * 0.3
    osc.type = 'sine'
    osc.frequency.value = 120 + i * 20
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.25, t + 0.15)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    osc.start(t); osc.stop(t + 0.3)
  }
}

// Broadcast fanfare
function broadcastFanfare(ctx: AudioContext) {
  const notes = [440, 554, 659, 880]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    const t = ctx.currentTime + i * 0.18
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.4, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.start(t); osc.stop(t + 0.35)
  })
}