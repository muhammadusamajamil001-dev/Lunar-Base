export class LunarAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private muted = false;
  private initialized = false;

  public unlock() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.42;
      this.masterGain.connect(this.ctx.destination);

      // Subtle pressurized habitat life-support hum
      this.humGain = this.ctx.createGain();
      this.humGain.gain.value = 0.032;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;

      this.humOsc1 = this.ctx.createOscillator();
      this.humOsc1.type = 'sine';
      this.humOsc1.frequency.value = 56;

      this.humOsc2 = this.ctx.createOscillator();
      this.humOsc2.type = 'triangle';
      this.humOsc2.frequency.value = 112;

      this.humOsc1.connect(filter);
      this.humOsc2.connect(filter);
      filter.connect(this.humGain);
      this.humGain.connect(this.masterGain);

      this.humOsc1.start();
      this.humOsc2.start();
      this.initialized = true;
    } catch {
      // Audio unavailable
    }
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.42, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted() {
    return this.muted;
  }

  public playAlarmSirenPulse() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc2.type = 'triangle';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);

    // Classic sci-fi base klaxon sweep
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.55);
    osc2.frequency.setValueAtTime(524, now);
    osc2.frequency.exponentialRampToValueAtTime(344, now + 0.55);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.06);
    gain.gain.setValueAtTime(0.12, now + 0.42);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.65);
    osc2.stop(now + 0.65);
  }

  public playTransmissionSignal() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [880, 1174.66, 880, 1318.51];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.08;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  public playFootstep(isSprint: boolean) {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isSprint ? 92 : 76, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.09);

    gain.gain.setValueAtTime(isSprint ? 0.14 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playTerminalChime() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playHoloScanOpen() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(1080, now + 0.18);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);

    const ping = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1318.51, now + 0.12);
    pingGain.gain.setValueAtTime(0.001, now + 0.12);
    pingGain.gain.linearRampToValueAtTime(0.07, now + 0.14);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    ping.connect(pingGain);
    pingGain.connect(this.masterGain);
    ping.start(now + 0.12);
    ping.stop(now + 0.36);
  }

  public playSalvageSuccess() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. Sub-bass sci-fi cargo lock-in sweep
    const sweep = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(140, now);
    sweep.frequency.exponentialRampToValueAtTime(320, now + 0.22);
    sweepGain.gain.setValueAtTime(0.001, now);
    sweepGain.gain.linearRampToValueAtTime(0.14, now + 0.03);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    sweep.connect(sweepGain);
    sweepGain.connect(this.masterGain);
    sweep.start(now);
    sweep.stop(now + 0.35);

    // 2. Crystalline ascending futuristic arpeggio + octave shimmer
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      overtone.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      overtone.frequency.setValueAtTime(freq * 2, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc.connect(gain);
      overtone.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      overtone.start(t);
      osc.stop(t + 0.4);
      overtone.stop(t + 0.4);
    });
  }

  public playNavigationPing(returningToBase = false) {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const baseFreq = returningToBase ? 987.77 : 1174.66;

    const osc = this.ctx.createOscillator();
    const harmonic = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const hGain = this.ctx.createGain();

    osc.type = 'sine';
    harmonic.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    harmonic.frequency.setValueAtTime(baseFreq * 1.5, now + 0.04);

    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.36);

    hGain.gain.setValueAtTime(0.0005, now + 0.04);
    hGain.gain.linearRampToValueAtTime(0.022, now + 0.055);
    hGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.32);

    osc.connect(gain);
    harmonic.connect(hGain);
    gain.connect(this.masterGain);
    hGain.connect(this.masterGain);

    osc.start(now);
    harmonic.start(now + 0.04);
    osc.stop(now + 0.38);
    harmonic.stop(now + 0.34);
  }

  public playQuizChime(correct: boolean) {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (correct) {
      const notes = [587.33, 880.0, 1174.66];
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const overtone = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.065;
        osc.type = 'sine';
        overtone.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        overtone.frequency.setValueAtTime(freq * 2, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.11, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(gain);
        overtone.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        overtone.start(t);
        osc.stop(t + 0.34);
        overtone.stop(t + 0.34);
      });
    } else {
      const pulses = [246.94, 185.0];
      pulses.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.13;
        osc.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(520, t);
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(freq * 0.88, t + 0.11);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.09, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.16);
      });
    }
  }

  public playEnergyAbsorption() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.2;
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.exponentialRampToValueAtTime(1650, now + 0.42);

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();

    oscA.type = 'sawtooth';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(165, now);
    oscA.frequency.exponentialRampToValueAtTime(520, now + 0.44);
    oscB.frequency.setValueAtTime(330, now);
    oscB.frequency.exponentialRampToValueAtTime(1040, now + 0.44);

    sweepGain.gain.setValueAtTime(0.001, now);
    sweepGain.gain.linearRampToValueAtTime(0.14, now + 0.06);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(sweepGain);
    sweepGain.connect(this.masterGain);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.5);
    oscB.stop(now + 0.5);

    const shimmer = this.ctx.createOscillator();
    const shimmerGain = this.ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1046.5, now + 0.14);
    shimmer.frequency.exponentialRampToValueAtTime(1567.98, now + 0.42);
    shimmerGain.gain.setValueAtTime(0.001, now + 0.14);
    shimmerGain.gain.linearRampToValueAtTime(0.08, now + 0.22);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.masterGain);
    shimmer.start(now + 0.14);
    shimmer.stop(now + 0.54);
  }

  public playReactorIgnitionBuildup() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 3-second rising harmonic reactor turbine & plasma resonance buildup
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4.0;
    filter.frequency.setValueAtTime(120, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 2.95);
    filter.connect(this.masterGain);

    const turbineA = this.ctx.createOscillator();
    const turbineB = this.ctx.createOscillator();
    const subThrum = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    turbineA.type = 'sawtooth';
    turbineB.type = 'triangle';
    subThrum.type = 'sine';

    turbineA.frequency.setValueAtTime(65.41, now);
    turbineA.frequency.exponentialRampToValueAtTime(392.0, now + 2.95);
    turbineB.frequency.setValueAtTime(130.81, now);
    turbineB.frequency.exponentialRampToValueAtTime(784.0, now + 2.95);
    subThrum.frequency.setValueAtTime(42, now);
    subThrum.frequency.exponentialRampToValueAtTime(98, now + 2.95);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 1.8);
    gain.gain.linearRampToValueAtTime(0.22, now + 2.92);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.05);

    turbineA.connect(filter);
    turbineB.connect(filter);
    subThrum.connect(gain);
    filter.connect(gain);
    gain.connect(this.masterGain);

    turbineA.start(now);
    turbineB.start(now);
    subThrum.start(now);
    turbineA.stop(now + 3.08);
    turbineB.stop(now + 3.08);
    subThrum.stop(now + 3.08);

    // 10 rapid artifact lock-in sparks leading into ignition
    for (let i = 0; i < 10; i++) {
      const t = now + i * 0.27;
      const spark = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      spark.type = 'sine';
      spark.frequency.setValueAtTime(520 + i * 95, t);
      sGain.gain.setValueAtTime(0.001, t);
      sGain.gain.linearRampToValueAtTime(0.065, t + 0.015);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      spark.connect(sGain);
      sGain.connect(this.masterGain);
      spark.start(t);
      spark.stop(t + 0.18);
    }
  }

  public playReactorShockwave() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. Deep seismic sub-bass shockwave impact
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(140, now);
    boom.frequency.exponentialRampToValueAtTime(32, now + 1.45);
    boomGain.gain.setValueAtTime(0.001, now);
    boomGain.gain.linearRampToValueAtTime(0.32, now + 0.03);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.55);
    boom.connect(boomGain);
    boomGain.connect(this.masterGain);
    boom.start(now);
    boom.stop(now + 1.6);

    // 2. Radiant plasma energy wave sweep across the base
    const sweepFilter = this.ctx.createBiquadFilter();
    sweepFilter.type = 'bandpass';
    sweepFilter.Q.value = 1.8;
    sweepFilter.frequency.setValueAtTime(2200, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(240, now + 1.6);
    sweepFilter.connect(this.masterGain);

    const waveOsc = this.ctx.createOscillator();
    const waveGain = this.ctx.createGain();
    waveOsc.type = 'sawtooth';
    waveOsc.frequency.setValueAtTime(523.25, now);
    waveOsc.frequency.exponentialRampToValueAtTime(130.81, now + 1.6);
    waveGain.gain.setValueAtTime(0.001, now);
    waveGain.gain.linearRampToValueAtTime(0.16, now + 0.04);
    waveGain.gain.exponentialRampToValueAtTime(0.001, now + 1.65);
    waveOsc.connect(sweepFilter);
    waveOsc.connect(waveGain);
    waveGain.connect(this.masterGain);
    waveOsc.start(now);
    waveOsc.stop(now + 1.7);

    // Restore warm full nominal life-support hum
    if (this.humGain && this.humOsc1 && this.humOsc2) {
      this.humGain.gain.setTargetAtTime(0.055, now + 0.2, 0.4);
      this.humOsc1.frequency.setTargetAtTime(65.41, now + 0.2, 0.4);
      this.humOsc2.frequency.setTargetAtTime(130.81, now + 0.2, 0.4);
    }
  }

  public playPowerRestoredChord() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Uplifting sci-fi orchestral swell: warm filtered string-brass pad + deep bass + rising chime bells
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.Q.value = 1.4;
    padFilter.frequency.setValueAtTime(320, now);
    padFilter.frequency.exponentialRampToValueAtTime(3200, now + 2.2);
    padFilter.frequency.exponentialRampToValueAtTime(1600, now + 6.4);
    padFilter.connect(this.masterGain);

    const voices = [
      { freq: 65.41, type: 'triangle' as OscillatorType, peak: 0.12, detune: 0 }, // C2 bass
      { freq: 130.81, type: 'sawtooth' as OscillatorType, peak: 0.065, detune: -4 }, // C3
      { freq: 196.0, type: 'sawtooth' as OscillatorType, peak: 0.06, detune: 3 }, // G3
      { freq: 261.63, type: 'sawtooth' as OscillatorType, peak: 0.065, detune: -5 }, // C4
      { freq: 329.63, type: 'sawtooth' as OscillatorType, peak: 0.065, detune: 5 }, // E4
      { freq: 392.0, type: 'triangle' as OscillatorType, peak: 0.075, detune: -3 }, // G4
      { freq: 493.88, type: 'sine' as OscillatorType, peak: 0.06, detune: 2 }, // B4
      { freq: 587.33, type: 'sine' as OscillatorType, peak: 0.055, detune: 4 }, // D5
    ];

    voices.forEach((v, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.06;
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.freq, t);
      osc.detune.setValueAtTime(v.detune, t);
      gain.gain.setValueAtTime(0.0008, t);
      gain.gain.linearRampToValueAtTime(v.peak, t + 0.9);
      gain.gain.setValueAtTime(v.peak * 0.88, t + 3.2);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 6.6);
      osc.connect(gain);
      gain.connect(padFilter);
      osc.start(t);
      osc.stop(t + 6.8);
    });

    // Celestial high orchestral harp/bell arpeggio over the swelling chord
    const bells = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98, 2093.0];
    bells.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + 0.3 + idx * 0.26;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0008, t);
      gain.gain.linearRampToValueAtTime(0.065, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 2.0);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 2.1);
    });
  }

  public playAirlockCycle() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.35);

    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.35);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playVisorToggle() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.06);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playJumpThrust() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.16);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public dispose() {
    try {
      this.humOsc1?.stop();
      this.humOsc2?.stop();
      if (this.ctx && this.ctx.state !== 'closed') {
        void this.ctx.close();
      }
    } catch {
      // Ignore cleanup errors
    }
    this.ctx = null;
    this.initialized = false;
  }
}
