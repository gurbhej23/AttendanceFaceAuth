let audioCtx: AudioContext | null = null;
let ringTimer: ReturnType<typeof setInterval> | null = null;
let ringNodes: OscillatorNode[] = [];
let ringGain: GainNode | null = null;

const getCtx = () => {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
};

export const unlockCallAudio = async () => {
  const ctx = getCtx();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
};

const stopRingNodes = () => {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
  ringNodes.forEach((node) => {
    try {
      node.stop();
      node.disconnect();
    } catch {
      /* already stopped */
    }
  });
  ringNodes = [];
  ringGain?.disconnect();
  ringGain = null;
};

const playTone = (
  frequency: number,
  durationMs: number,
  volume = 0.18,
  type: OscillatorType = "sine",
) => {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
  ringNodes.push(osc);
};

const startRingPattern = (frequencies: [number, number], volume: number) => {
  stopRingNodes();
  const ctx = getCtx();
  ringGain = ctx.createGain();
  ringGain.gain.value = volume;
  ringGain.connect(ctx.destination);

  let step = 0;
  const runStep = () => {
    const phase = step % 4;
    if (phase === 0 || phase === 2) {
      frequencies.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(ringGain!);
        osc.start();
        ringNodes.push(osc);
        window.setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            /* noop */
          }
        }, 360);
      });
    } else {
      ringNodes.forEach((node) => {
        try {
          node.stop();
          node.disconnect();
        } catch {
          /* noop */
        }
      });
      ringNodes = [];
    }
    step += 1;
  };

  runStep();
  ringTimer = setInterval(runStep, 520);
};

export const startIncomingRingtone = () => {
  void unlockCallAudio();
  startRingPattern([440, 480], 0.2);
};

export const startOutgoingRingtone = () => {
  void unlockCallAudio();
  startRingPattern([350, 400], 0.12);
};

export const stopIncomingRingtone = () => stopRingNodes();
export const stopOutgoingRingtone = () => stopRingNodes();

export const stopAllRingtones = () => stopRingNodes();

export const playCallEndSound = () => {
  void unlockCallAudio();
  playTone(520, 120, 0.14);
  window.setTimeout(() => playTone(380, 180, 0.12), 140);
};
