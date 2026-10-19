import { useEffect, useRef, useState } from 'preact/hooks';
import { apply, historyCsv, load, newDay, save, undo, type Change, type Counter, type TrackerState } from './state';
import './tracker.css';

const iconUrl = (name: string) => `${import.meta.env.BASE_URL}card-icons/${name}.webp`;

const parse = (text: string) => {
  const v = Number(text);
  return text.trim() !== '' && Number.isFinite(v) ? Math.round(v) : null;
};

/** Typing a number: focused once when it opens, saved on Enter or when focus leaves, Escape cancels. */
function ValueInput({ name, value, done }: { name: string; value: number; done: (v: number | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (v: number | null) => {
    if (finished.current) return;
    finished.current = true;
    done(v);
  };
  return (
    <input
      ref={ref}
      class="counter__input"
      type="number"
      inputMode="numeric"
      defaultValue={String(value)}
      aria-label={`${name} value`}
      onBlur={(e) => finish(parse(e.currentTarget.value))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(parse(e.currentTarget.value));
        else if (e.key === 'Escape') finish(null);
      }}
    />
  );
}

function CounterCard({
  c,
  low,
  onChange,
  onSet,
}: {
  c: Counter;
  low: boolean;
  onChange: (delta: number) => void;
  onSet: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div class={`counter panel${low ? ' counter--low' : ''}`}>
      <div class="counter__head">
        {c.icon ? <img class="counter__icon" src={iconUrl(c.icon)} alt="" /> : <span class="counter__icon counter__icon--custom" aria-hidden="true">{c.name.charAt(0)}</span>}
        <span class="counter__name">{c.name}</span>
      </div>
      {editing ? (
        <ValueInput
          name={c.name}
          value={c.value}
          done={(v) => {
            if (v !== null) onSet(v);
            setEditing(false);
          }}
        />
      ) : (
        <button type="button" class="counter__value" aria-label={`${c.name}: ${c.value}. Tap to type a number.`} onClick={() => setEditing(true)}>
          {c.value}
        </button>
      )}
      <div class="counter__buttons">
        <button type="button" class="counter__btn" onClick={() => onChange(-5)} aria-label={`${c.name} minus 5`}>
          −5
        </button>
        <button type="button" class="counter__btn counter__btn--big" onClick={() => onChange(-1)} aria-label={`${c.name} minus 1`}>
          −
        </button>
        <button type="button" class="counter__btn counter__btn--big" onClick={() => onChange(1)} aria-label={`${c.name} plus 1`}>
          +
        </button>
        <button type="button" class="counter__btn" onClick={() => onChange(5)} aria-label={`${c.name} plus 5`}>
          +5
        </button>
      </div>
    </div>
  );
}

function Setup({ s, set, close }: { s: TrackerState; set: (fn: (s: TrackerState) => TrackerState) => void; close: () => void }) {
  const [name, setName] = useState('');
  const edit = (id: string, patch: Partial<Counter>) => set((st) => ({ ...st, counters: st.counters.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  return (
    <div class="panel tracker__setup">
      <div class="panel__head">
        <h2>Counters</h2>
        <button type="button" class="btn btn--small" onClick={close}>
          Done
        </button>
      </div>
      <p class="tracker__note">Set what each day starts with. Changes apply from the next new day.</p>
      <table class="setup-table">
        <thead>
          <tr>
            <th>Counter</th>
            <th>Day starts at</th>
            <th>
              <span class="visually-hidden">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {s.counters.map((c) => (
            <tr key={c.id}>
              <td>
                <input class="input" type="text" value={c.name} maxLength={20} aria-label="Counter name" onInput={(e) => edit(c.id, { name: e.currentTarget.value })} />
              </td>
              <td>
                <input class="input input--num" type="number" value={c.start} aria-label={`${c.name} at the start of a day`} onInput={(e) => edit(c.id, { start: Math.round(Number(e.currentTarget.value) || 0) })} />
              </td>
              <td>
                <button type="button" class="linklike" onClick={() => set((st) => ({ ...st, counters: st.counters.filter((x) => x.id !== c.id) }))}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        class="setup-add"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          set((st) => ({ ...st, counters: [...st.counters, { id: `c${Date.now()}`, name: n, icon: null, value: 0, start: 0 }] }));
          setName('');
        }}
      >
        <input class="input" type="text" placeholder="New counter, e.g. Stars" maxLength={20} value={name} onInput={(e) => setName(e.currentTarget.value)} aria-label="New counter name" />
        <button type="submit" class="btn btn--small">
          Add
        </button>
      </form>
      <label class="field">
        <span class="field__label">Warn when steps are at or below</span>
        <input class="input input--num" type="number" min="0" value={s.lowSteps} onInput={(e) => set((st) => ({ ...st, lowSteps: Math.max(0, Math.round(Number(e.currentTarget.value) || 0)) }))} />
      </label>
    </div>
  );
}

export function Tracker() {
  const [s, setS] = useState<TrackerState>(load);
  const [setup, setSetup] = useState(false);
  const [awake, setAwake] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);
  const set = (fn: (st: TrackerState) => TrackerState) => setS((st) => fn(st));
  const change = (changes: Change[]) => set((st) => apply(st, changes));

  useEffect(() => save(s), [s]);

  // Keyboard: R entered a room, U or Ctrl+Z undo.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (e.key === 'r' || e.key === 'R') change([{ id: 'steps', delta: -1 }, { id: 'rooms', delta: 1 }]);
      else if (e.key === 'u' || e.key === 'U' || ((e.ctrlKey || e.metaKey) && e.key === 'z')) set(undo);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // Keep the screen awake while playing (phones), re-taken when the page comes back into view.
  useEffect(() => {
    if (!awake) {
      lock.current?.release().catch(() => {});
      lock.current = null;
      return;
    }
    const take = () => navigator.wakeLock?.request('screen').then((l) => (lock.current = l)).catch(() => setAwake(false));
    take();
    const vis = () => document.visibilityState === 'visible' && take();
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [awake]);

  const steps = s.counters.find((c) => c.id === 'steps');
  const lastChange = s.undo[s.undo.length - 1];

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([historyCsv(s.history)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blue-prince-days.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div class="tracker">
      <header class="tool-head">
        <h1>Run Tracker</h1>
        <p>Keep count of a day's steps, gems, keys and coins while you play, on a phone or a second screen. It's saved in this browser.</p>
      </header>

      <div class="tracker__bar panel">
        <div class="tracker__day">
          <span class="label">Day</span>
          <b>{s.day}</b>
        </div>
        <div class="tracker__day">
          <span class="label">Rooms</span>
          <b>{s.rooms}</b>
        </div>
        <div class="tracker__bar-actions">
          <button type="button" class="btn btn--small" disabled={!lastChange} onClick={() => set(undo)} title="Undo (U)">
            Undo
          </button>
          <button
            type="button"
            class="btn btn--small"
            onClick={() => {
              if (confirm(`End day ${s.day} and start day ${s.day + 1}? Counters go back to their start values.`)) set(newDay);
            }}
          >
            New day
          </button>
        </div>
      </div>

      <button
        type="button"
        class={`tracker__room btn btn--primary${steps && steps.value <= s.lowSteps ? ' tracker__room--low' : ''}`}
        onClick={() => change([{ id: 'steps', delta: -1 }, { id: 'rooms', delta: 1 }])}
        title="R"
      >
        Entered a room <span>(−1 step)</span>
      </button>

      <div class="tracker__grid">
        {s.counters.map((c) => (
          <CounterCard
            key={c.id}
            c={c}
            low={c.id === 'steps' && c.value <= s.lowSteps}
            onChange={(delta) => change([{ id: c.id, delta }])}
            onSet={(v) => v !== c.value && change([{ id: c.id, delta: v - c.value }])}
          />
        ))}
      </div>

      <div class="tracker__lower">
        <div class="panel">
          <label class="field tracker__notefield">
            <span class="field__label">Notes for today</span>
            <textarea class="input" rows={3} maxLength={1000} value={s.note} onInput={(e) => set((st) => ({ ...st, note: e.currentTarget.value }))} />
          </label>
          <div class="tracker__options">
            <button type="button" class="btn btn--small" onClick={() => setSetup(!setup)}>
              {setup ? 'Close counters' : 'Edit counters'}
            </button>
            {'wakeLock' in navigator && (
              <label class="check">
                <input type="checkbox" checked={awake} onChange={(e) => setAwake(e.currentTarget.checked)} /> Keep the screen on
              </label>
            )}
          </div>
          <p class="tracker__note">Keys: R entered a room, U undo.</p>
        </div>

        {setup && <Setup s={s} set={set} close={() => setSetup(false)} />}

        <div class="panel">
          <div class="panel__head">
            <h2>Past days</h2>
            {s.history.length > 0 && (
              <div class="panel__actions">
                <button type="button" class="btn btn--small" onClick={downloadCsv}>
                  Download CSV
                </button>
                <button type="button" class="btn btn--small" onClick={() => confirm('Delete the history of past days?') && set((st) => ({ ...st, history: [] }))}>
                  Clear
                </button>
              </div>
            )}
          </div>
          {s.history.length === 0 ? (
            <p class="tracker__note">Days you finish with "New day" appear here.</p>
          ) : (
            <div class="history-wrap">
              <table class="history">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Rooms</th>
                    {s.history[0].values.map((v) => (
                      <th key={v.name}>{v.name}</th>
                    ))}
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {s.history.slice(0, 60).map((r) => (
                    <tr key={r.finished}>
                      <td>{r.day}</td>
                      <td>{r.rooms}</td>
                      {s.history[0].values.map((v) => (
                        <td key={v.name}>{r.values.find((x) => x.name === v.name)?.value ?? '–'}</td>
                      ))}
                      <td class="history__note">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
