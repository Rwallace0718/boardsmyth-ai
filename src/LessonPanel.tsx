import { useState } from 'react';
import type { Lesson } from '../shared/types';

/** Teaching mode: plain-English walkthrough, key terms and self-check questions. */
export default function LessonPanel({ lesson }: { lesson?: Lesson }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  if (!lesson) {
    return (
      <div className="wiring-empty muted">
        Turn on <strong>Teaching mode</strong> under the prompt box, then press Generate. You get a walkthrough of the code, the key terms, and three
        questions to check what you learned.
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
