import { useEffect, useRef, useState } from 'react';
import { shrinkPhoto } from './partPhotos';

/** Lets the customer take a picture with a webcam or pick a photo file, for one part or board in the wiring picture. */
export default function CameraModal({ title, onPhoto, onClose }: { title: string; onPhoto: (dataUrl: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [err, setErr] = useState('');
  const [live, setLive] = useState(false);

  useEffect(() => {
    let dead = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (dead) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().then(() => setLive(true)).catch(() => undefined);
        }
      })
      .catch(() => setErr('No camera available (or camera access is turned off). You can pick a photo file instead.'));
    return () => {
      dead = true;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function snap() {
    if (!video.current) return;
    try {
      onPhoto(await shrinkPhoto(video.current));
    } catch {
      setErr('Could not take the picture. Try again.');
    }
  }

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    try {
      onPhoto(await shrinkPhoto(f));
    } catch {
      setErr('That file could not be read as a picture.');
    }
  }

  return (
    <div className="cam-backdrop" onClick={onClose}>
      <div className="cam-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Photo of ${title}`}>
        <h3>Photo of {title}</h3>
        <p className="muted small">The photo is saved on this computer only and shows in the wiring picture in place of the drawing.</p>
        {!err && <video ref={video} className="cam-video" muted playsInline />}
        {err && <p className="cam-err">{err}</p>}
        <div className="cam-actions">
          <button className="primary" disabled={!live} onClick={() => void snap()}>
            Take photo
          </button>
          <label className="link-btn cam-file">
            Choose a photo file
            <input type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files)} />
          </label>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
