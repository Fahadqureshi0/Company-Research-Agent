import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  MotionConfig,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
} from "framer-motion";
import "./App.css";

const API = "http://localhost:8000";
const EXAMPLES = ["NVIDIA", "Microsoft", "Tesla", "Stripe", "OpenAI"];
const TITLE = "Company Research Agent";

/* ---------- motion presets ---------- */

// Page load: children fade up one after another (plays once)
const container = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};
const chipsContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
};
const chipItem = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 420, damping: 22 } },
};
const titleContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } },
};
const letter = {
  hidden: { opacity: 0, y: 44, rotate: 10 },
  show: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { type: "spring", stiffness: 260, damping: 15 },
  },
};

// Status panels: enter, leave
const panelAnim = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
  transition: { duration: 0.25 },
};

/* ---------- helpers ---------- */

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable, ignore */
  }
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Wait that can be cancelled with an AbortSignal
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

/* ---------- small components ---------- */

// Animated gradient blobs and floating shapes behind everything
function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      <span className="shape s1" />
      <span className="shape s2" />
      <span className="shape s3" />
      <span className="shape s4" />
      <span className="shape s5" />
    </div>
  );
}

// Title: each letter springs in, and lifts when you hover it
function AnimatedTitle({ text }) {
  return (
    <div className="title-block">
      <motion.h1 aria-label={text} variants={titleContainer}>
        {text.split(" ").map((word, wi) => (
          <span className="word" key={wi} aria-hidden="true">
            {word.split("").map((ch, i) => (
              <motion.span
                key={i}
                className="char"
                variants={letter}
                whileHover={{ y: -7, transition: { duration: 0.15 } }}
              >
                {ch}
              </motion.span>
            ))}
          </span>
        ))}
      </motion.h1>
      <motion.span
        className="title-rule"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 1.1, duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

// Card that tilts toward the mouse, with a soft light that follows it
function TiltCard({ children, className = "", max = 6, ...rest }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 200, damping: 18, mass: 0.6 };
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring);
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring);
  const gx = useTransform(px, [0, 1], [0, 100]);
  const gy = useTransform(py, [0, 1], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(280px circle at ${gx}% ${gy}%, var(--glare), transparent 65%)`;

  function onMove(e) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  }

  function onLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <motion.section
      ref={ref}
      className={`tilt ${className}`}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      {...rest}
    >
      {children}
      <div className="glare-wrap" aria-hidden="true">
        <motion.div className="glare" style={{ background: glare }} />
      </div>
    </motion.section>
  );
}

// Types its text out letter by letter while active
function Typed({ text, active }) {
  const [n, setN] = useState(active ? 0 : text.length);

  useEffect(() => {
    if (!active) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 14);
    return () => clearInterval(id);
  }, [text, active]);

  return (
    <>
      {text.slice(0, n)}
      {active && <span className="caret" />}
    </>
  );
}

// A checkmark that draws itself when it appears
function Check({ size = 12 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </svg>
  );
}

// Small burst of dots when a report finishes
function Burst() {
  return (
    <div className="burst" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="spark"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * 48,
              y: Math.sin(angle) * 48,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          />
        );
      })}
    </div>
  );
}

/* ---------- app ---------- */

export default function App() {
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [elapsed, setElapsed] = useState(0);
  const [took, setTook] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [events, setEvents] = useState([]);
  const [copied, setCopied] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [history, setHistory] = useState(() => load("reports", []));
  const [theme, setTheme] = useState(() => load("theme", "light"));
  const abortRef = useRef(null);
  const jobRef = useRef(null);
  const feedRef = useRef(null);
  const lastCompany = useRef("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    save("theme", theme);
  }, [theme]);

  useEffect(() => {
    save("reports", history);
  }, [history]);

  // Elapsed-time counter while a request is running
  useEffect(() => {
    if (status !== "running") return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, [status]);

  // Rotate the example in the placeholder while the box is empty
  useEffect(() => {
    if (company || status === "running") return;
    const id = setInterval(() => setPhIdx((i) => (i + 1) % EXAMPLES.length), 2500);
    return () => clearInterval(id);
  }, [company, status]);

  // Keep the activity feed scrolled to the newest line
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  async function run(name) {
    const target = name.trim();
    if (!target || status === "running") return;

    lastCompany.current = target;
    const controller = new AbortController();
    abortRef.current = controller;
    jobRef.current = null;
    const { signal } = controller;
    const startedAt = Date.now();
    setStatus("running");
    setError("");
    setResult(null);
    setEvents([]);
    setCopied(false);

    function finish(url, id) {
      const entry = {
        id: id || url,
        company: target,
        url,
        date: new Date().toISOString(),
      };
      setResult(entry);
      setTook(Math.round((Date.now() - startedAt) / 1000));
      setHistory((h) => [entry, ...h.filter((x) => x.id !== entry.id)].slice(0, 10));
      setStatus("done");
    }

    try {
      const r = await fetch(`${API}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: target }),
        signal,
      });
      if (!r.ok) throw new Error(`The server returned an error (${r.status}).`);
      const data = await r.json();

      // Older backend that answers with the finished report directly
      if (data.download_url) {
        finish(data.download_url, data.report_id);
        return;
      }

      jobRef.current = data.job_id;
      for (;;) {
        await sleep(1000, signal);
        const s = await fetch(`${API}/status/${data.job_id}`, { signal });
        if (!s.ok) throw new Error(`Status check failed (${s.status}).`);
        const job = await s.json();
        setEvents((prev) => (prev.length === job.events.length ? prev : job.events));

        if (job.status === "done") {
          finish(job.download_url, job.report_id);
          return;
        }
        if (job.status === "error") throw new Error(job.error || "The agent failed.");
        if (job.status === "cancelled") {
          setStatus("idle");
          return;
        }
      }
    } catch (e) {
      if (e.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError(
        e.message === "Failed to fetch"
          ? "Can't reach the backend at localhost:8000. Check that uvicorn is running."
          : e.message
      );
      setStatus("error");
    }
  }

  function cancel() {
    abortRef.current?.abort();
    if (jobRef.current) {
      fetch(`${API}/cancel/${jobRef.current}`, { method: "POST" }).catch(() => {});
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    run(company);
  }

  function pick(name) {
    setCompany(name);
    run(name);
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const running = status === "running";
  const canSubmit = company.trim().length > 0;

  return (
    <MotionConfig reducedMotion="user">
      <Background />
      <motion.div
        className="page"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.header className="top" variants={item}>
          <AnimatedTitle text={TITLE} />
          <motion.button
            className="ghost"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Toggle dark mode"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                style={{ display: "inline-block" }}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {theme === "light" ? "Dark mode" : "Light mode"}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </motion.header>

        <motion.p className="lead" variants={item}>
          Type a company name. The agent searches the web, reads company pages,
          pulls market data, and gives you a PDF report.
        </motion.p>

        <motion.form className="search" onSubmit={onSubmit} variants={item}>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={`e.g. ${EXAMPLES[phIdx]}`}
            disabled={running}
            autoFocus
            aria-label="Company name"
          />
          <AnimatePresence mode="wait" initial={false}>
            {running ? (
              <motion.button
                key="cancel"
                type="button"
                className="danger"
                onClick={cancel}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                whileTap={{ scale: 0.95 }}
              >
                Cancel
              </motion.button>
            ) : (
              <motion.button
                key="go"
                type="submit"
                disabled={!canSubmit}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                whileHover={canSubmit ? { scale: 1.04 } : undefined}
                whileTap={canSubmit ? { scale: 0.95 } : undefined}
              >
                Generate report
              </motion.button>
            )}
          </AnimatePresence>
        </motion.form>

        <motion.div className="chips" variants={chipsContainer}>
          {EXAMPLES.map((name) => (
            <motion.button
              key={name}
              className="chip"
              variants={chipItem}
              onClick={() => pick(name)}
              disabled={running}
              whileHover={running ? undefined : { y: -3 }}
              whileTap={running ? undefined : { scale: 0.92 }}
            >
              {name}
            </motion.button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {running && (
            <TiltCard key="running" className="panel" aria-live="polite" {...panelAnim}>
              <div className="panel-head">
                <strong>Researching {lastCompany.current}</strong>
                <span className="timer">{formatTime(elapsed)}</span>
              </div>

              <div className="track" aria-hidden="true">
                <div className="bar indeterminate" />
              </div>

              <ul className="feed" ref={feedRef}>
                {events.length === 0 && (
                  <li className="feed-item">
                    <span className="kind k-info" />
                    <span className="ft">0:00</span>
                    <span className="fx">
                      <Typed text="Connecting to the agent..." active />
                    </span>
                  </li>
                )}
                {events.map((ev, i) => (
                  <motion.li
                    key={i}
                    className="feed-item"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className={`kind k-${ev.kind}`} />
                    <span className="ft">{formatTime(ev.t)}</span>
                    <span className="fx">
                      <Typed text={ev.text} active={i === events.length - 1} />
                    </span>
                  </motion.li>
                ))}
              </ul>
              <p className="hint">
                Reports usually take 30 to 90 seconds. Each line is a real step
                the agent just took.
              </p>
            </TiltCard>
          )}

          {status === "error" && (
            <TiltCard
              key="error"
              className="panel error"
              role="alert"
              {...panelAnim}
              animate={{ opacity: 1, y: 0, scale: 1, x: [0, -9, 9, -5, 5, 0] }}
              transition={{ duration: 0.4 }}
            >
              <strong>Report failed</strong>
              <p>{error}</p>
              <motion.button
                onClick={() => run(lastCompany.current)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
              >
                Try again
              </motion.button>
            </TiltCard>
          )}

          {status === "done" && result && (
            <TiltCard key="done" className="panel success" {...panelAnim}>
              <div className="done-row">
                <div className="badge-wrap">
                  <motion.div
                    className="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.1 }}
                  >
                    <Check size={22} />
                  </motion.div>
                  <Burst />
                </div>
                <div>
                  <strong>{result.company} report is ready</strong>
                  <p className="hint tight">Finished in {formatTime(took)}.</p>
                </div>
              </div>
              <div className="actions">
                <motion.a
                  className="btn"
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Download PDF
                </motion.a>
                <motion.button
                  className="ghost"
                  onClick={() => copyLink(result.url)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {copied ? "Link copied" : "Copy link"}
                </motion.button>
              </div>

              {events.length > 0 && (
                <details className="log">
                  <summary>Agent activity ({events.length} steps)</summary>
                  <ul className="feed">
                    {events.map((ev, i) => (
                      <li key={i} className="feed-item">
                        <span className={`kind k-${ev.kind}`} />
                        <span className="ft">{formatTime(ev.t)}</span>
                        <span className="fx">{ev.text}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </TiltCard>
          )}
        </AnimatePresence>

        <TiltCard className="panel history" max={3} variants={item}>
          <div className="panel-head">
            <h2>Past reports</h2>
            {history.length > 0 && (
              <button className="ghost small" onClick={() => setHistory([])}>
                Clear all
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="hint">
              Reports you generate appear here, so you can download them again.
            </p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {history.map((h) => (
                  <motion.li
                    key={h.id}
                    layout
                    style={{ overflow: "hidden" }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30, height: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div>
                      <span className="name">{h.company}</span>
                      <span className="date">
                        {new Date(h.date).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <div className="row-actions">
                      <a href={h.url} target="_blank" rel="noreferrer">
                        Download
                      </a>
                      <button
                        className="ghost small"
                        onClick={() => pick(h.company)}
                        disabled={running}
                      >
                        Re-run
                      </button>
                      <button
                        className="ghost small"
                        onClick={() =>
                          setHistory((list) => list.filter((x) => x.id !== h.id))
                        }
                        aria-label={`Remove ${h.company} report`}
                      >
                        Remove
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </TiltCard>
      </motion.div>
    </MotionConfig>
  );
}