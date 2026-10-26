import { useEffect, useRef, useState } from 'react';

// Cinematic startup splash. Plays once per launch on top of the app (which loads underneath).
// Click, Skip, Esc or Enter jumps straight in. The video is bundled, so this works offline.
export default function Splash({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const doneRef = useRef(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    window.setTimeout(onDone, 450);
  }

  useEffect(() => {
    const t = window.setTimeout(() => setShowTitle(true), 4200);
    // Safety net: never trap the user if the video cannot play.
    const safety = window.setTimeout(finish, 12000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(safety);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <div className={`splash ${leaving ? 'leaving' : ''}`} onClick={finish}>
      <video
        ref={videoRef}
        className="splash-video"
        src="./splash.mp4"
        autoPlay
        playsInline
        onEnded={finish}
        onError={finish}
      />
      <div className={`splash-title ${showTitle ? 'show' : ''}`}>
        <div className="splash-name">BoardSmyth AI</div>
        <div className="splash-tag">Describe it. Upload it.</div>
      </div>
      <div className="splash-controls" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setMuted((m) => !m)}>{muted ? 'Sound off' : 'Sound on'}</button>
        <button onClick={finish}>Skip</button>
      </div>
    </div>
  );
}
