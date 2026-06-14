/**
 * Thin wrapper over the Agora Web SDK for 1-on-1 calls. Lazy-loads the SDK so
 * it never touches the SSR/initial bundle. Joins with App-ID auth and no token,
 * matching the mobile app, so web and mobile peers meet in the same channel.
 */
let AgoraRTCMod: any = null;

async function getAgora(): Promise<any> {
  if (!AgoraRTCMod) {
    AgoraRTCMod = (await import('agora-rtc-sdk-ng')).default;
  }
  return AgoraRTCMod;
}

export type AgoraSession = {
  leave: () => Promise<void>;
  setMic: (on: boolean) => void;
  setCam: (on: boolean) => void;
};

export async function joinCall(opts: {
  appId: string;
  channel: string;
  localEl: HTMLElement;
  remoteEl: HTMLElement;
  onRemoteJoined?: () => void;
  onRemoteLeft?: () => void;
}): Promise<AgoraSession> {
  const AgoraRTC = await getAgora();
  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

  client.on('user-published', async (user: any, mediaType: 'audio' | 'video') => {
    await client.subscribe(user, mediaType);
    if (mediaType === 'video') {
      user.videoTrack?.play(opts.remoteEl);
    }
    if (mediaType === 'audio') {
      user.audioTrack?.play();
    }
    // Flip "connected" as soon as the remote publishes anything, so an
    // audio-first (or camera-off) peer doesn't leave us stuck on "Connecting…".
    opts.onRemoteJoined?.();
  });
  client.on('user-left', () => opts.onRemoteLeft?.());

  await client.join(opts.appId, opts.channel, null, null);

  const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
  camTrack.play(opts.localEl);
  await client.publish([micTrack, camTrack]);

  return {
    leave: async () => {
      try {
        micTrack.close();
        camTrack.close();
        await client.leave();
      } catch {
        /* already gone */
      }
    },
    setMic: (on: boolean) => micTrack.setEnabled(on).catch(() => {}),
    setCam: (on: boolean) => camTrack.setEnabled(on).catch(() => {}),
  };
}
