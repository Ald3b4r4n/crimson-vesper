const MUTE_STORAGE_KEY = 'crimson_vesper.muted';

export class GothicAudio {
  private ctx: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private muted: boolean;
  private gemStreak = 0;
  private lastGemTime = 0;
  private lastHitTime = 0;
  private lastTriggerTimes: Record<string, number> = {};
  private noteCursor = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? '1' : '0');
    } catch {
      // ignore storage errors
    }
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtor();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getOutputBus(ctx: AudioContext): AudioNode {
    if (this.masterBus && this.masterBus.context === ctx) {
      return this.masterBus;
    }

    // Warm master SFX bus: gentle lowpass roll-off + dynamics compressor eliminates harshness & spam fatigue
    const inputGain = ctx.createGain();
    inputGain.gain.value = 0.76;

    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.value = 3900;
    warmthFilter.Q.value = 0.65;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 14;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.14;

    inputGain.connect(warmthFilter);
    warmthFilter.connect(compressor);
    compressor.connect(ctx.destination);

    this.masterBus = inputGain;
    return this.masterBus;
  }

  private getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.pinkNoiseBuffer && this.pinkNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.pinkNoiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const out = buffer.getChannelData(0);

    // Paul Kellet pink-noise filter -> warm organic air/leather/fire texture instead of harsh white static
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }
    this.pinkNoiseBuffer = buffer;
    return buffer;
  }

  /**
   * Throttles repetitive weapon sounds and returns a dynamic ducking multiplier (0 = skip, 0.55..1.0 = softened).
   */
  private acquireSlot(key: string, now: number, minIntervalSec: number): number {
    const prev = this.lastTriggerTimes[key] ?? -10;
    const elapsed = now - prev;
    if (elapsed < minIntervalSec) return 0;
    this.lastTriggerTimes[key] = now;
    // Soften volume automatically when firing rapidly in late-game builds
    return elapsed < minIntervalSec * 2.2 ? 0.62 : 1.0;
  }

  private randJitter(spread = 0.1): number {
    return 1 + (Math.random() * 2 - 1) * spread;
  }

  playWhip(evolved = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duck = this.acquireSlot('whip', now, 0.16);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);
    const jitter = this.randJitter(0.12);

    // 1. Deep physical leather air-whoosh (pink noise bandpass sweep)
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = this.getPinkNoiseBuffer(ctx);
    const offset = Math.random() * 0.6;

    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    whooshFilter.Q.setValueAtTime(1.15, now);
    whooshFilter.frequency.setValueAtTime((evolved ? 360 : 290) * jitter, now);
    whooshFilter.frequency.exponentialRampToValueAtTime(95 * jitter, now + 0.15);

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.001, now);
    whooshGain.gain.linearRampToValueAtTime(0.11 * duck, now + 0.022);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(bus);
    whoosh.start(now, offset, 0.17);

    // 2. Soft, damped leather tip snap (low-passed so it never pierces)
    const snap = ctx.createBufferSource();
    snap.buffer = this.getPinkNoiseBuffer(ctx);
    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = 'bandpass';
    snapFilter.Q.setValueAtTime(1.6, now + 0.03);
    snapFilter.frequency.setValueAtTime((evolved ? 1120 : 920) * jitter, now + 0.03);
    snapFilter.frequency.exponentialRampToValueAtTime(310, now + 0.095);

    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.001, now);
    snapGain.gain.setValueAtTime(0.058 * duck, now + 0.03);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.098);

    snap.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(bus);
    snap.start(now + 0.028, offset + 0.1, 0.08);

    // 3. Low physical air thump
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime((evolved ? 128 : 108) * jitter, now);
    sub.frequency.exponentialRampToValueAtTime(44, now + 0.11);
    subGain.gain.setValueAtTime(0.052 * duck, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.115);
    sub.connect(subGain);
    subGain.connect(bus);
    sub.start(now);
    sub.stop(now + 0.12);
  }

  playWand(evolved = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Throttle multi-bolt bursts into one smooth crystalline dark-arcane shimmer per cast
    const duck = this.acquireSlot('wand', now, 0.18);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);

    // Warm D-minor pentatonic low-mid voicings (never high/shrill laser beeps)
    const palette = evolved
      ? [293.66, 349.23, 440.0, 523.25, 587.33]
      : [246.94, 293.66, 329.63, 392.0, 440.0];
    const baseFreq = palette[this.noteCursor % palette.length] * this.randJitter(0.025);
    this.noteCursor++;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(evolved ? 980 : 780, now);
    filter.frequency.exponentialRampToValueAtTime(260, now + 0.15);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.96, now + 0.14);

    // Soft 14ms attack avoids clicky transient
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.042 * duck, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.155);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playAxe(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duck = this.acquireSlot('axe', now, 0.18);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);
    const jitter = this.randJitter(0.1);

    // Heavy iron halberd air-cleave (deep pink noise wind + low sine displacement, ZERO sawtooth buzz)
    const wind = ctx.createBufferSource();
    wind.buffer = this.getPinkNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.3, now);
    filter.frequency.setValueAtTime(230 * jitter, now);
    filter.frequency.exponentialRampToValueAtTime(68, now + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.1 * duck, now + 0.028);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    wind.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    wind.start(now, Math.random() * 0.5, 0.2);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(96 * jitter, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.15);
    subGain.gain.setValueAtTime(0.055 * duck, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    sub.connect(subGain);
    subGain.connect(bus);
    sub.start(now);
    sub.stop(now + 0.165);
  }

  playDaggers(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duck = this.acquireSlot('daggers', now, 0.16);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);
    const jitter = this.randJitter(0.12);

    // Whisper-soft shadow-blade air brush
    const slice = ctx.createBufferSource();
    slice.buffer = this.getPinkNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.9, now);
    filter.frequency.setValueAtTime(680 * jitter, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + 0.085);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.048 * duck, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    slice.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    slice.start(now, Math.random() * 0.6, 0.1);
  }

  playCross(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duck = this.acquireSlot('cross', now, 0.2);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);
    const jitter = this.randJitter(0.06);

    // Warm spinning relic hum (soft sine + spinning air whoosh)
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(164.81 * jitter, now + 0.17);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(540, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.042 * duck, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.175);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playFlask(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duck = this.acquireSlot('flask', now, 0.22);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);
    const jitter = this.randJitter(0.1);

    // Warm alchemical ember ignition ("fwoosh")
    const fire = ctx.createBufferSource();
    fire.buffer = this.getPinkNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340 * jitter, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075 * duck, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);

    fire.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    fire.start(now, Math.random() * 0.5, 0.22);
  }

  playThunder(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duck = this.acquireSlot('thunder', now, 0.22);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);
    const jitter = this.randJitter(0.12);

    // Realistic rolling thunder rumble + deep sub pulse (ZERO raw sawtooth buzz!)
    const rumble = ctx.createBufferSource();
    rumble.buffer = this.getPinkNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(1.8, now);
    filter.frequency.setValueAtTime(280 * jitter, now);
    filter.frequency.exponentialRampToValueAtTime(52, now + 0.28);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11 * duck, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);

    rumble.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    rumble.start(now, Math.random() * 0.4, 0.3);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(88 * jitter, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.24);
    subGain.gain.setValueAtTime(0.068 * duck, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    sub.connect(subGain);
    subGain.connect(bus);
    sub.start(now);
    sub.stop(now + 0.26);
  }

  playHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastHitTime < 0.095) return;
    this.lastHitTime = now;
    const bus = this.getOutputBus(ctx);
    const jitter = this.randJitter(0.15);

    // Soft, muted low body thud instead of rapid high-pitched woodpecker clicks
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(108 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.048);

    gain.gain.setValueAtTime(0.036, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.052);

    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.056);
  }

  playGem(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastGemTime < 0.4) {
      this.gemStreak = Math.min(7, this.gemStreak + 1);
    } else {
      this.gemStreak = 0;
    }
    if (now - this.lastGemTime < 0.055) return;
    this.lastGemTime = now;
    const bus = this.getOutputBus(ctx);

    // Gentle muted gothic harp drop (no squeaky upward pitch slide)
    const scale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 523.25, 587.33];
    const baseFreq = scale[this.gemStreak % scale.length];

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.036, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playDash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bus = this.getOutputBus(ctx);

    const wind = ctx.createBufferSource();
    wind.buffer = this.getPinkNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.2, now);
    filter.frequency.setValueAtTime(380, now);
    filter.frequency.exponentialRampToValueAtTime(110, now + 0.16);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    wind.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    wind.start(now, Math.random() * 0.4, 0.18);
  }

  playHurt(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bus = this.getOutputBus(ctx);

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.16);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, now);

    gain.gain.setValueAtTime(0.095, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playLevelUp(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bus = this.getOutputBus(ctx);
    const notes = [293.66, 349.23, 440.0, 587.33]; // D minor gothic chord

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.075, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  playBossHorn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duck = this.acquireSlot('boss_horn', now, 0.75);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);

    [110, 164.81].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.96, now + 0.85);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.095 * duck, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      osc.start(now);
      osc.stop(now + 0.92);
    });
  }

  playChest(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bus = this.getOutputBus(ctx);
    const notes = [293.66, 392.0, 493.88, 587.33, 783.99];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }

  playBreak(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duck = this.acquireSlot('break', now, 0.08);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getPinkNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.1, now);
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.085);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.085 * duck, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    noise.start(now, Math.random() * 0.5, 0.095);
  }

  playPickup(isMagnet = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duck = this.acquireSlot(isMagnet ? 'pickup_magnet' : 'pickup', now, isMagnet ? 0.25 : 0.085);
    if (duck <= 0) return;
    const bus = this.getOutputBus(ctx);
    const freqs = isMagnet ? [349.23, 440, 587.33, 698.46] : [392.0, 493.88, 587.33];

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.068 * duck, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}

export const gothicAudio = new GothicAudio();
