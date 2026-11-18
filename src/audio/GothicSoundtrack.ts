import { StageId } from '../data/loreData';

const BGM_MUTE_KEY = 'crimson_vesper.bgm_muted';

type TrackMode = 'none' | 'menu' | 'wilderness' | 'cathedral' | 'inferno';

interface Composition {
  rootMidi: number;
  baseBpm: number;
  scale: number[]; // semitone offsets
  chordRoots: number[]; // scale degree offsets per bar (4 bars)
  arpPattern: number[]; // 8th/16th note scale indices
  melody: Array<number | null>; // 16-step melody per 2-bar phrase (scale degree or null)
}

const COMPOSITIONS: Record<Exclude<TrackMode, 'none'>, Composition> = {
  menu: {
    rootMidi: 50, // D3 Harmonic Minor
    baseBpm: 74,
    scale: [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19],
    chordRoots: [0, 5, 3, 4], // Dm - Bb - Gm - A7
    arpPattern: [0, 2, 4, 7, 4, 2, 0, 4],
    melody: [7, null, 6, 7, 8, null, 7, 5, 4, null, 3, 2, 4, null, null, null],
  },
  wilderness: {
    rootMidi: 50, // D3 Harmonic Minor (Castlevania / Forest / Dungeon vibe)
    baseBpm: 122,
    scale: [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19],
    chordRoots: [0, 5, 2, 4], // Dm - Bb - F - A7
    arpPattern: [0, 4, 7, 4, 8, 7, 4, 2],
    melody: [7, 7, 8, 7, 5, 4, 5, 7, 9, 8, 7, 5, 6, null, 7, null],
  },
  cathedral: {
    rootMidi: 48, // C3 Harmonic Minor (Haunted Castle & Desecrated Temple Toccata)
    baseBpm: 126,
    scale: [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19],
    chordRoots: [0, 3, 5, 4], // Cm - Fm - Ab - G7
    arpPattern: [7, 6, 7, 4, 5, 4, 2, 3],
    melody: [7, null, 9, 8, 7, 5, 4, 6, 7, null, 10, 9, 8, 7, 6, 7],
  },
  inferno: {
    rootMidi: 40, // E2 Phrygian Dominant / Dies Irae (Volcano, Metropolis, Hell)
    baseBpm: 130,
    scale: [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19],
    chordRoots: [0, 1, 5, 4], // E - F - C - B
    arpPattern: [0, 4, 7, 8, 7, 4, 1, 4],
    // Dies Irae inspired dark motif!
    melody: [8, null, 7, 8, 6, null, 7, 5, 6, 6, 7, 6, 4, null, 0, null],
  },
};

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class GothicSoundtrack {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private dryBus: GainNode | null = null;
  private wetBus: GainNode | null = null;

  private muted: boolean;
  private currentMode: TrackMode = 'none';
  private actLevel: 1 | 2 | 3 | 4 = 1;
  private bossActive = false;

  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem(BGM_MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }

    // Unlock Web Audio automatically on first user gesture
    if (typeof window !== 'undefined') {
      const unlock = () => {
        if (!this.muted && this.currentMode !== 'none') {
          this.ensureAudioGraph();
          if (this.ctx?.state === 'suspended') {
            this.ctx.resume().catch(() => {});
          }
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      localStorage.setItem(BGM_MUTE_KEY, mute ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0.0001 : 0.34, this.ctx.currentTime, 0.08);
    }
    if (!mute && this.currentMode !== 'none') {
      this.startLoop();
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  playMenuMusic(): void {
    this.actLevel = 1;
    this.bossActive = false;
    this.switchMode('menu');
  }

  playStageMusic(stageId: StageId): void {
    this.actLevel = 1;
    this.bossActive = false;
    if (stageId === 'forest' || stageId === 'dungeon') {
      this.switchMode('wilderness');
    } else if (stageId === 'castle' || stageId === 'temple') {
      this.switchMode('cathedral');
    } else {
      this.switchMode('inferno');
    }
  }

  setBattleIntensity(act: 1 | 2 | 3 | 4, bossActive: boolean): void {
    this.actLevel = act;
    this.bossActive = bossActive;
  }

  stop(): void {
    this.currentMode = 'none';
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private switchMode(mode: TrackMode): void {
    if (this.currentMode === mode && this.schedulerId !== null) return;
    this.currentMode = mode;
    this.stepIndex = 0;
    if (!this.muted && mode !== 'none') {
      this.startLoop();
    }
  }

  private ensureAudioGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;

    if (!this.ctx) {
      const ctx = new AudioCtor();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0.0001 : 0.34;
      master.connect(ctx.destination);
      this.masterGain = master;

      const dry = ctx.createGain();
      dry.gain.value = 0.68;
      dry.connect(master);
      this.dryBus = dry;

      // Algorithmic Stereo Cathedral Impulse Response (1.8s lush dark reverb)
      const irLen = Math.floor(ctx.sampleRate * 1.8);
      const irBuf = ctx.createBuffer(2, irLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = irBuf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < irLen; i++) {
          const decay = Math.pow(1 - i / irLen, 2.6);
          const white = (Math.random() * 2 - 1) * decay;
          lp = lp * 0.82 + white * 0.18; // Dark stone cathedral damping!
          data[i] = lp;
        }
      }

      const conv = ctx.createConvolver();
      conv.buffer = irBuf;
      const wet = ctx.createGain();
      wet.gain.value = 0.45;
      conv.connect(wet);
      wet.connect(master);

      this.reverbNode = conv;
      this.wetBus = wet;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private startLoop(): void {
    const ctx = this.ensureAudioGraph();
    if (!ctx) return;

    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
    }
    this.nextStepTime = ctx.currentTime + 0.06;
    this.schedulerId = window.setInterval(() => this.scheduleSteps(), 50);
  }

  private scheduleSteps(): void {
    if (this.muted || this.currentMode === 'none') return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const comp = COMPOSITIONS[this.currentMode];
    const actSpeedBoost =
      this.currentMode === 'menu' ? 0 : (this.actLevel - 1) * 6 + (this.bossActive ? 6 : 0);
    const bpm = comp.baseBpm + actSpeedBoost;
    const sixteenthSec = 60 / bpm / 4;

    while (this.nextStepTime < ctx.currentTime + 0.16) {
      this.triggerStep(ctx, comp, this.stepIndex, this.nextStepTime, sixteenthSec);
      this.nextStepTime += sixteenthSec;
      this.stepIndex = (this.stepIndex + 1) % 64; // 4-bar cycle (64 sixteenth notes)
    }
  }

  private triggerStep(
    ctx: AudioContext,
    comp: Composition,
    step: number,
    t: number,
    stepDur: number
  ): void {
    const bar = Math.floor(step / 16) % 4;
    const stepInBar = step % 16;
    const chordDegree = comp.chordRoots[bar];
    const chordRootMidi = comp.rootMidi + comp.scale[chordDegree];

    if (this.currentMode === 'menu') {
      // Haunting Harpsichord on 8th notes + Cathedral Organ Pad on bar start
      if (stepInBar === 0) {
        this.voiceOrganChord(ctx, chordRootMidi, comp, chordDegree, t, stepDur * 15.5, 0.08);
      }
      if (step % 2 === 0) {
        const arpDeg = chordDegree + comp.arpPattern[(step / 2) % 8];
        const note = comp.rootMidi + 12 + comp.scale[arpDeg % comp.scale.length];
        this.voiceHarpsichord(ctx, note, t, stepDur * 2.2, 0.09);
      }
      if (step % 4 === 0) {
        const m = comp.melody[(step / 4) % 16];
        if (m !== null) {
          this.voiceLeadViolin(ctx, comp.rootMidi + 24 + comp.scale[m], t, stepDur * 3.8, 0.065);
        }
      }
      return;
    }

    // BATTLE SOUNDTRACK (4 Dynamic 10-Minute Acts + Boss Overdrive!)
    const intensity = this.bossActive ? 4 : this.actLevel;

    // 1. Driving Gothic Bass Ostinato (8th notes in Act 1-2, galloping 16ths in Act 3-4!)
    const playBass =
      intensity >= 3 ? step % 2 === 0 || step % 4 === 3 : step % 2 === 0;
    if (playBass) {
      const octaveShift = stepInBar % 4 === 2 ? 12 : 0;
      this.voiceCelloBass(ctx, chordRootMidi - 12 + octaveShift, t, stepDur * 1.7, 0.14);
    }

    // 2. Baroque Harpsichord Arpeggio (16th notes)
    const arpIdx = comp.arpPattern[step % 8];
    const arpScalePos = (chordDegree + arpIdx) % comp.scale.length;
    const arpMidi = comp.rootMidi + 12 + comp.scale[arpScalePos];
    this.voiceHarpsichord(ctx, arpMidi, t, stepDur * 1.2, 0.075);

    // 3. Cathedral Pipe Organ Harmony (Enters strongly from Act II / Bosses, soft pad in Act I)
    if (stepInBar === 0 || (intensity >= 3 && stepInBar === 8)) {
      const organDur = intensity >= 3 ? stepDur * 7.5 : stepDur * 15;
      const organGain = intensity >= 2 ? 0.085 : 0.045;
      this.voiceOrganChord(ctx, chordRootMidi, comp, chordDegree, t, organDur, organGain);
    }

    // 4. Gothic Lead Melody (8th-note phrasing across 2-bar phrases)
    if (step % 2 === 0) {
      const melStep = Math.floor(step / 2) % 16;
      const deg = comp.melody[melStep];
      if (deg !== null && (bar % 2 === 1 || intensity >= 2)) {
        const leadOctave = intensity >= 4 ? 24 : 12;
        const leadMidi = comp.rootMidi + leadOctave + comp.scale[deg % comp.scale.length];
        this.voiceLeadViolin(ctx, leadMidi, t, stepDur * 2.1, intensity >= 3 ? 0.095 : 0.07);
      }
    }

    // 5. Orchestral War Timpani & Dark Percussion (Scales across Acts 1 -> 4!)
    if (stepInBar === 0 || stepInBar === 8 || (intensity >= 3 && stepInBar === 12)) {
      this.voiceWarTimpani(ctx, midiToHz(comp.rootMidi - 12), t, intensity >= 2 ? 0.16 : 0.1);
    }
    if (intensity >= 2 && (stepInBar === 4 || stepInBar === 12)) {
      this.voiceSnareBrush(ctx, t, intensity >= 4 ? 0.07 : 0.045);
    }
  }

  private connectBuses(node: AudioNode, wetSend = 0.5): void {
    if (!this.dryBus || !this.reverbNode || !this.ctx) return;
    node.connect(this.dryBus);
    if (wetSend > 0) {
      const send = this.ctx.createGain();
      send.gain.value = wetSend;
      node.connect(send);
      send.connect(this.reverbNode);
    }
  }

  private voiceHarpsichord(
    ctx: AudioContext,
    midi: number,
    t: number,
    dur: number,
    peak: number
  ): void {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const hz = midiToHz(midi);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, t);
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(hz * 2, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(hz * 4.5, t);
    filter.frequency.exponentialRampToValueAtTime(hz * 1.4, t + dur);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    this.connectBuses(gain, 0.55);

    osc.start(t);
    sub.start(t);
    osc.stop(t + dur + 0.02);
    sub.stop(t + dur + 0.02);
  }

  private voiceOrganChord(
    ctx: AudioContext,
    rootMidi: number,
    comp: Composition,
    degree: number,
    t: number,
    dur: number,
    peak: number
  ): void {
    const thirdMidi =
      comp.rootMidi + comp.scale[(degree + 2) % comp.scale.length];
    const fifthMidi =
      comp.rootMidi + comp.scale[(degree + 4) % comp.scale.length];
    const notes = [rootMidi, thirdMidi + 12, fifthMidi + 12];

    const bus = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1350, t);

    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(peak, t + 0.09);
    bus.gain.setValueAtTime(peak * 0.85, t + Math.max(0.1, dur - 0.12));
    bus.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    filter.connect(bus);
    this.connectBuses(bus, 0.75);

    for (const m of notes) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const hz = midiToHz(m);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(hz, t);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(hz * 2, t);
      osc1.connect(filter);
      osc2.connect(filter);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + dur + 0.03);
      osc2.stop(t + dur + 0.03);
    }
  }

  private voiceCelloBass(
    ctx: AudioContext,
    midi: number,
    t: number,
    dur: number,
    peak: number
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const hz = midiToHz(midi);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, t);
    filter.frequency.exponentialRampToValueAtTime(150, t + dur);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    this.connectBuses(gain, 0.2);

    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private voiceLeadViolin(
    ctx: AudioContext,
    midi: number,
    t: number,
    dur: number,
    peak: number
  ): void {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const hz = midiToHz(midi);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, t);

    // Expressive gothic string vibrato
    lfo.frequency.setValueAtTime(5.6, t);
    lfoGain.gain.setValueAtTime(hz * 0.008, t);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2100, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    this.connectBuses(gain, 0.7);

    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.02);
    lfo.stop(t + dur + 0.02);
  }

  private voiceWarTimpani(ctx: AudioContext, hz: number, t: number, peak: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz * 1.45, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(38, hz * 0.72), t + 0.19);

    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    this.connectBuses(gain, 0.35);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  private voiceSnareBrush(ctx: AudioContext, t: number, peak: number): void {
    const len = Math.floor(ctx.sampleRate * 0.07);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    src.connect(bp);
    bp.connect(gain);
    this.connectBuses(gain, 0.4);
    src.start(t);
  }
}

export const gothicSoundtrack = new GothicSoundtrack();
