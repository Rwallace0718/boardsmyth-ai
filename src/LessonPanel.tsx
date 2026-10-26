import { useState } from 'react';
import type { Lesson } from '../shared/types';

/** Teaching mode: plain-English walkthrough, key terms and self-check questions. */
export default function LessonPanel({
  lesson,
  teach,
  onExplain,
  canExplain,
}: {
  lesson?: Lesson;
  teach: boolean;
  onExplain: () => void;
  canExplain: boolean;
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  if (!lesson) {
    return (
      <div className="wiring-empty muted">
        <p>
          {teach
            ? 'Teaching mode is on. The lesson for your next program shows here after you press Generate.'
            : 'Turn on Teaching mode under the prompt box, then press Generate, to get a walkthrough, the key terms and three questions.'}
        </p>
        <p>
          Want a lesson on the program that is in the editor now?{' '}
          <button className="link-btn" disabled={!canExplain} onClick={onExplain}>
            Explain this program
          </button>{' '}
          (uses 1 generation, the program is not changed).
        </p>
      </div>
    );
  }
  return (
    <div className="lesson">
      <p>{lesson.summary}</p>

      <h3>Walkthrough</h3>
      <ol>
        {lesson.walkthrough.map((w, i) => (
          <li key={i}>
            <code>{w.part}</code> {w.explain}
          </li>
        ))}
      </ol>

      {lesson.concepts.length > 0 && (
        <>
          <h3>Key terms</h3>
          <dl>
            {lesson.concepts.map((c, i) => (
              <div key={i}>
                <dt>{c.term}</dt>
                <dd>{c.meaning}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {lesson.quiz.length > 0 && (
        <>
          <h3>Check yourself</h3>
          {lesson.quiz.map((q, i) => (
            <div key={i} className="quiz">
              <div>
                {i + 1}. {q.q}
              </div>
              <button className="link-btn" onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
                {open[i] ? 'Hide answer' : 'Show answer'}
              </button>
              {open[i] && <div className="answer">{q.a}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
