import { Routes, Route, useNavigate, Link, Navigate } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  SignUp,
  SignIn,
  useAuth,
  useUser,
} from "@clerk/clerk-react";
import { useState, useEffect, useCallback, useRef } from "react";

const PROVIDER_DEFAULTS = {
  gemini: "gemini-1.5-flash",
  openai: "gpt-4o-mini",
  claude: "claude-haiku-4-5-20251001",
  openrouter: "google/gemini-flash-1.5",
  custom: "",
};

export default function App({ clerkEnabled }) {
  if (!clerkEnabled) {
    return <DashboardNoAuth />;
  }
  return (
    <Routes>
      <Route path="/" element={<RootGate />} />
      <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
      <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
      <Route path="/dashboard" element={
        <SignedIn>
          <Dashboard />
        </SignedIn>
      } />
      <Route path="*" element={
        <SignedOut>
          <Landing />
        </SignedOut>
      } />
    </Routes>
  );
}

function RootGate() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isLoaded && isSignedIn) navigate("/dashboard", { replace: true });
  }, [isLoaded, isSignedIn, navigate]);
  if (!isLoaded) return null;
  return <Landing />;
}

/* ====== LANDING PAGE ====== */
function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cyber-black grid-bg">
      <header className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyber-cyan/5 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-cyber-magenta/5 blur-[100px]" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-8 px-4 py-2 glass rounded-full">
            <span className="w-2 h-2 rounded-full bg-cyber-emerald animate-pulse" />
            <span className="text-xs text-cyber-muted uppercase tracking-[0.2em]">
              MVP — Now Live
            </span>
          </div>

          <h1 className="text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight leading-none mb-6">
            <span className="text-cyber-text">Spec</span>
            <span className="text-cyber-cyan text-glow">Track</span>
          </h1>

          <p className="text-lg sm:text-xl text-cyber-muted max-w-2xl mx-auto mb-4 leading-relaxed">
            Dependency intelligence for the modern stack.
            <br />
            Track release notes, detect breaking changes, and stay ahead — all
            with{" "}
            <span className="text-cyber-cyan">your own AI key</span>.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-10">
            <button
              onClick={() => navigate("/sign-up")}
              className="px-8 py-3 bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan 
                         rounded-lg font-semibold text-sm tracking-wide
                         hover:bg-cyber-cyan/20 hover:border-cyber-cyan/60 
                         transition-all duration-300 glow"
            >
              Start Tracking
            </button>
            <a
              href="#features"
              className="px-8 py-3 border border-cyber-border rounded-lg text-cyber-muted 
                         font-medium text-sm tracking-wide inline-block
                         hover:border-cyber-magenta/40 hover:text-cyber-text
                         transition-all duration-300"
            >
              How It Works
            </a>
          </div>

          <div className="mt-16 flex items-center justify-center gap-8 text-xs text-cyber-muted">
            {["BYOK Privacy", "Real-time Analysis", "Release Intelligence"].map(
              (tag) => (
                <span key={tag} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-cyber-cyan/60" />
                  {tag}
                </span>
              )
            )}
          </div>
        </div>

        <div className="absolute bottom-8 animate-bounce">
          <svg
            className="w-5 h-5 text-cyber-cyan/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </header>

      <section id="features" className="max-w-6xl mx-auto px-4 py-24 sm:py-32">
        <div className="text-center mb-16">
          <span className="inline-block text-xs text-cyber-muted uppercase tracking-[0.2em] mb-3">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-cyber-text">
            Track smarter, not harder
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { num: "01", title: "Connect", desc: "Paste any GitHub repository URL. SpecTrack fetches the latest release notes automatically.", color: "cyan" },
            { num: "02", title: "Analyze", desc: "Your AI provider of choice (Gemini, GPT, Claude) parses the release and extracts breaking changes, features, and deprecations.", color: "magenta" },
            { num: "03", title: "Stay Informed", desc: "Results are saved for later review. Never miss a critical dependency update again.", color: "amber" },
          ].map((f, i) => (
            <div
              key={f.title}
              className={`glass glass-hover rounded-xl p-8 card-gradient transition-all duration-500 hover:-translate-y-1`}
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <span className={`text-4xl font-black ${
                f.color === "cyan" ? "text-cyber-cyan" : f.color === "magenta" ? "text-cyber-magenta" : "text-cyber-amber"
              }`}>
                {f.num}
              </span>
              <h3 className="text-lg font-bold text-cyber-text mt-4 mb-2">{f.title}</h3>
              <p className="text-sm text-cyber-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <button
            onClick={() => navigate("/sign-up")}
            className="px-8 py-3 bg-cyber-magenta/10 border border-cyber-magenta/40 text-cyber-magenta 
                       rounded-lg font-semibold text-sm tracking-wide
                       hover:bg-cyber-magenta/20 hover:border-cyber-magenta/60 
                       transition-all duration-300 glow-magenta"
          >
            Get Started → Dashboard
          </button>
        </div>
      </section>

      <footer className="border-t border-cyber-border/30 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-cyber-muted">
            <span className="text-cyber-cyan font-bold">Spec</span>
            <span className="font-bold">Track</span>{" "}
            <span className="text-cyber-muted/50">· MVP</span>
          </span>
          <span className="text-xs text-cyber-muted/40">
            BYOK · AI-Powered Dependency Intelligence
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ====== AUTH PAGES ====== */
function AuthPage({ mode }) {
  const navigate = useNavigate();
  const commonProps = {
    appearance: {
      elements: {
        rootBox: "w-full max-w-md mx-auto",
        card: "bg-cyber-darker border border-cyber-border rounded-xl shadow-none",
        headerTitle: "text-cyber-text font-bold text-xl",
        headerSubtitle: "text-cyber-muted text-sm",
        socialButtonsBlockButton:
          "bg-cyber-black border border-cyber-border text-cyber-text hover:border-cyber-cyan/40 hover:bg-cyber-cyan/5 rounded-lg",
        formFieldLabel: "text-cyber-muted text-xs uppercase tracking-wider",
        formFieldInput:
          "bg-cyber-black border border-cyber-border text-cyber-text rounded-lg focus:border-cyber-cyan/60",
        formButtonPrimary:
          "bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan rounded-lg hover:bg-cyber-cyan/20",
        footerActionLink: "text-cyber-cyan hover:underline",
        dividerLine: "bg-cyber-border",
        dividerText: "text-cyber-muted",
        identityPreviewEditButton: "text-cyber-cyan",
      },
    },
    afterSignUpUrl: "/dashboard",
    afterSignInUrl: "/dashboard",
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  };

  return (
    <div className="min-h-screen bg-cyber-black grid-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-extrabold tracking-tight">
            <span className="text-cyber-text">Spec</span>
            <span className="text-cyber-cyan">Track</span>
          </Link>
        </div>
        {mode === "sign-up" ? (
          <SignUp {...commonProps} />
        ) : (
          <SignIn {...commonProps} />
        )}
      </div>
    </div>
  );
}

/* ====== DASHBOARD (authenticated) ====== */
function Dashboard() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();

  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customHeaders, setCustomHeaders] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [logs, setLogs] = useState([]);
  const [latestResult, setLatestResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [tracking, setTracking] = useState(false);
  const consoleRef = useRef(null);

  const log = useCallback((text, type = "info") => {
    setLogs((prev) => [...prev, { text, type, ts: new Date().toLocaleTimeString() }]);
  }, []);

  const authFetch = useCallback(async (url, options = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        "Authorization": `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  }, [getToken]);

  const loadHistory = useCallback(async () => {
    log("Fetching history...", "info");
    try {
      const r = await authFetch("/api/history");
      const data = await r.json();
      if (data.records?.length) {
        setHistory(data.records);
        log(`Retrieved ${data.records.length} records.`, "ok");
      } else {
        setHistory([]);
        log("No records yet.", "warn");
      }
    } catch (e) {
      log(`History fetch failed: ${e.message}`, "err");
    }
  }, [authFetch, log]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs]);
  useEffect(() => {
    const def = PROVIDER_DEFAULTS[provider] || "";
    setModel((prev) => prev || def);
  }, [provider]);

  async function handleTrack() {
    if (!githubUrl.trim()) { log("Please enter a GitHub URL", "err"); return; }
    if (!apiKey.trim()) { log("Please enter an API key", "err"); return; }
    const payload = { github_url: githubUrl.trim(), provider, api_key: apiKey.trim() };
    if (model.trim()) payload.model = model.trim();
    if (customUrl.trim()) payload.custom_url = customUrl.trim();
    if (customHeaders.trim()) {
      try { payload.custom_headers = JSON.parse(customHeaders.trim()); }
      catch { log("Custom headers must be valid JSON", "err"); return; }
    }
    if (provider === "custom" && !customUrl.trim()) { log("Custom URL required for custom provider", "err"); return; }

    setTracking(true);
    log("Submitting to POST /api/track...", "info");
    try {
      const r = await authFetch("/api/track", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (r.ok) {
        setLatestResult(data);
        log(`SUCCESS — ${data.update.release_tag} via ${data.update.provider_used}`, "ok");
        await loadHistory();
      } else {
        const d = data.detail || data;
        log(`ERROR — ${d.error || "Unknown"}: ${d.detail || JSON.stringify(d)}`, "err");
      }
    } catch (e) {
      log(`Network error: ${e.message}`, "err");
    } finally {
      setTracking(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !tracking) handleTrack();
  }

  const renderList = (arr) => {
    if (!arr?.length) return <span className="text-cyber-muted italic">—</span>;
    return (
      <ul className="list-none space-y-1">
        {arr.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="text-cyber-cyan mt-0.5 shrink-0">▸</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  };

  const formatDate = (raw) => {
    try { return new Date(raw).toLocaleString(); }
    catch { return raw; }
  };

  return (
    <div className="min-h-screen bg-cyber-black grid-bg">
      {/* Dashboard header */}
      <header className="border-b border-cyber-border/30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-lg font-extrabold tracking-tight">
            <span className="text-cyber-text">Spec</span>
            <span className="text-cyber-cyan">Track</span>
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-xs text-cyber-muted hidden sm:inline">
                {user.primaryEmailAddress?.emailAddress || user.id?.slice(0, 8)}
              </span>
            )}
            <button
              onClick={() => signOut().then(() => navigate("/"))}
              className="px-3 py-1.5 text-xs rounded-lg border border-cyber-border text-cyber-muted
                         hover:border-cyber-magenta/40 hover:text-cyber-magenta transition-all duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Testing interface */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-semibold text-cyber-text uppercase tracking-wider">BYOK Config</span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">Provider</label>
                  <select value={provider} onChange={(e) => setProvider(e.target.value)}
                    className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200 appearance-none cursor-pointer">
                    <option value="gemini">Gemini (Google)</option>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude (Anthropic)</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Custom Endpoint</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">API Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..."
                    className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                </div>
                <div>
                  <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">Model</label>
                  <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
                    placeholder={PROVIDER_DEFAULTS[provider] || "model id"}
                    className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                </div>
                {provider === "custom" && (
                  <>
                    <div>
                      <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">Custom URL</label>
                      <input type="url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://..."
                        className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">Custom Headers <span className="text-cyber-muted/50">(JSON)</span></label>
                      <textarea rows={2} value={customHeaders} onChange={(e) => setCustomHeaders(e.target.value)}
                        placeholder='{"X-Key": "val"}'
                        className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono resize-none focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-cyber-amber" />
                <span className="text-sm font-semibold text-cyber-text uppercase tracking-wider">Track</span>
              </div>
              <div className="space-y-3">
                <input type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="https://github.com/owner/repository"
                  className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                <button onClick={handleTrack} disabled={tracking}
                  className="w-full px-6 py-3 rounded-lg font-semibold text-sm tracking-wider uppercase bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/20 hover:border-cyber-cyan/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 glow">
                  {tracking ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-cyber-cyan/30 border-t-cyber-cyan animate-spin" />
                      Analyzing...
                    </span>
                  ) : "Track Latest Release"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-3 space-y-6">
            <div className="glass rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-cyber-darker/50 border-b border-cyber-border">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyber-red" />
                  <span className="w-2.5 h-2.5 rounded-full bg-cyber-amber" />
                  <span className="w-2.5 h-2.5 rounded-full bg-cyber-emerald" />
                  <span className="ml-2 text-xs text-cyber-muted uppercase tracking-wider">Console</span>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-cyber-muted/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse" />
                  LIVE
                </span>
              </div>
              <div ref={consoleRef}
                className="h-64 overflow-y-auto p-4 bg-cyber-darker/30 font-mono text-xs leading-relaxed space-y-1">
                {logs.length === 0 && <span className="text-cyber-muted/40 italic">Waiting for activity...</span>}
                {logs.map((entry, i) => (
                  <div key={i} className="animate-fade-in">
                    <span className="text-cyber-muted/50">[{entry.ts}]</span>{" "}
                    <span className={
                      entry.type === "ok" ? "text-cyber-emerald"
                        : entry.type === "err" ? "text-cyber-red"
                          : entry.type === "warn" ? "text-cyber-amber"
                            : "text-cyber-cyan"
                    }>{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-cyber-text uppercase tracking-wider">Latest Result</span>
                {latestResult && (
                  <span className="text-[10px] text-cyber-emerald px-2 py-0.5 rounded-full bg-cyber-emerald/10 border border-cyber-emerald/20">
                    {latestResult.update?.release_tag}
                  </span>
                )}
              </div>
              <pre className="text-xs text-cyber-text leading-relaxed overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap font-mono">
                {latestResult ? JSON.stringify(latestResult, null, 2) : "No results yet. Track a repository to see output here."}
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-8 glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-semibold text-cyber-text uppercase tracking-wider">History</span>
            <button onClick={loadHistory}
              className="px-4 py-1.5 text-xs rounded-lg border border-cyber-border text-cyber-muted hover:border-cyber-cyan/40 hover:text-cyber-cyan transition-all duration-200">
              Refresh
            </button>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 opacity-20">⎔</div>
              <p className="text-sm text-cyber-muted italic">No records yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-cyber-border">
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Tracked At</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Repository</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Release</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Provider</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Breaking</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Features</th>
                    <th className="text-left py-2.5 text-cyber-muted uppercase tracking-wider font-medium">Deprecations</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i} className="border-b border-cyber-border/40 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 pr-4 text-cyber-muted whitespace-nowrap">{formatDate(r.tracked_at)}</td>
                      <td className="py-2.5 pr-4">
                        <a href={r.github_url || "#"} target="_blank" rel="noopener noreferrer"
                          className="text-cyber-cyan hover:underline">{r.owner}/{r.repo_name}</a>
                      </td>
                      <td className="py-2.5 pr-4 text-cyber-amber whitespace-nowrap">{r.release_tag}</td>
                      <td className="py-2.5 pr-4 text-cyber-muted">{r.provider_used}</td>
                      <td className="py-2.5 pr-4">{renderList(r.ai_analysis?.breaking_changes)}</td>
                      <td className="py-2.5 pr-4">{renderList(r.ai_analysis?.new_features)}</td>
                      <td className="py-2.5">{renderList(r.ai_analysis?.deprecations)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-cyber-border/30 py-6 px-4">
        <div className="max-w-7xl mx-auto text-center text-xs text-cyber-muted/40">
          BYOK · AI-Powered Dependency Intelligence · SpecTrack MVP
        </div>
      </footer>
    </div>
  );
}

/* ====== DASHBOARD (no auth fallback) ====== */
function DashboardNoAuth() {
  // Original single-page behavior when Clerk is not configured
  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customHeaders, setCustomHeaders] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [logs, setLogs] = useState([]);
  const [latestResult, setLatestResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [tracking, setTracking] = useState(false);
  const consoleRef = useRef(null);

  const log = useCallback((text, type = "info") => {
    setLogs((prev) => [...prev, { text, type, ts: new Date().toLocaleTimeString() }]);
  }, []);

  const loadHistory = useCallback(async () => {
    log("Fetching history...", "info");
    try {
      const r = await fetch("/api/history");
      const data = await r.json();
      if (data.records?.length) {
        setHistory(data.records);
        log(`Retrieved ${data.records.length} records.`, "ok");
      } else {
        setHistory([]);
        log("No records yet.", "warn");
      }
    } catch (e) {
      log(`History fetch failed: ${e.message}`, "err");
    }
  }, [log]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs]);
  useEffect(() => {
    const def = PROVIDER_DEFAULTS[provider] || "";
    setModel((prev) => prev || def);
  }, [provider]);

  async function handleTrack() {
    if (!githubUrl.trim()) { log("Please enter a GitHub URL", "err"); return; }
    if (!apiKey.trim()) { log("Please enter an API key", "err"); return; }
    const payload = { github_url: githubUrl.trim(), provider, api_key: apiKey.trim() };
    if (model.trim()) payload.model = model.trim();
    if (customUrl.trim()) payload.custom_url = customUrl.trim();
    if (customHeaders.trim()) {
      try { payload.custom_headers = JSON.parse(customHeaders.trim()); }
      catch { log("Custom headers must be valid JSON", "err"); return; }
    }
    if (provider === "custom" && !customUrl.trim()) { log("Custom URL required for custom provider", "err"); return; }
    setTracking(true);
    log("Submitting to POST /api/track...", "info");
    try {
      const r = await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await r.json();
      if (r.ok) {
        setLatestResult(data);
        log(`SUCCESS — ${data.update.release_tag} via ${data.update.provider_used}`, "ok");
        await loadHistory();
      } else {
        const d = data.detail || data;
        log(`ERROR — ${d.error || "Unknown"}: ${d.detail || JSON.stringify(d)}`, "err");
      }
    } catch (e) { log(`Network error: ${e.message}`, "err"); }
    finally { setTracking(false); }
  }

  const renderList = (arr) => {
    if (!arr?.length) return <span className="text-cyber-muted italic">—</span>;
    return <ul className="list-none space-y-1">{arr.map((item, i) => (
      <li key={i} className="flex items-start gap-2 text-xs"><span className="text-cyber-cyan mt-0.5 shrink-0">▸</span><span>{item}</span></li>
    ))}</ul>;
  };

  const formatDate = (raw) => { try { return new Date(raw).toLocaleString(); } catch { return raw; } };

  return (
    <div className="min-h-screen bg-cyber-black grid-bg">
      {/* Hero */}
      <header className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyber-cyan/5 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-cyber-magenta/5 blur-[100px]" />
        </div>
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-3 mb-8 px-4 py-2 glass rounded-full">
            <span className="w-2 h-2 rounded-full bg-cyber-emerald animate-pulse" />
            <span className="text-xs text-cyber-muted uppercase tracking-[0.2em]">MVP — Now Live</span>
          </div>
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight leading-none mb-6">
            <span className="text-cyber-text">Spec</span>
            <span className="text-cyber-cyan text-glow">Track</span>
          </h1>
          <p className="text-lg sm:text-xl text-cyber-muted max-w-2xl mx-auto mb-8 leading-relaxed">
            Dependency intelligence for the modern stack.
            <br />
            Track release notes, detect breaking changes, and stay ahead — all with <span className="text-cyber-cyan">your own AI key</span>.
          </p>
        </div>
        <div className="absolute bottom-8 animate-bounce">
          <svg className="w-5 h-5 text-cyber-cyan/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </header>

      {/* Testing area (no auth) */}
      <section className="max-w-7xl mx-auto px-4 pb-32">
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-semibold text-cyber-text uppercase tracking-wider">BYOK Config</span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">Provider</label>
                  <select value={provider} onChange={(e) => setProvider(e.target.value)}
                    className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200 appearance-none cursor-pointer">
                    <option value="gemini">Gemini (Google)</option>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude (Anthropic)</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Custom Endpoint</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">API Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..."
                    className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                </div>
                <div>
                  <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">Model</label>
                  <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
                    placeholder={PROVIDER_DEFAULTS[provider] || "model id"}
                    className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                </div>
                {provider === "custom" && (
                  <>
                    <div>
                      <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">Custom URL</label>
                      <input type="url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://..."
                        className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs text-cyber-muted mb-1.5 uppercase tracking-wider">Custom Headers <span className="text-cyber-muted/50">(JSON)</span></label>
                      <textarea rows={2} value={customHeaders} onChange={(e) => setCustomHeaders(e.target.value)} placeholder='{"X-Key": "val"}'
                        className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono resize-none focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-cyber-amber" />
                <span className="text-sm font-semibold text-cyber-text uppercase tracking-wider">Track</span>
              </div>
              <div className="space-y-3">
                <input type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !tracking && handleTrack()}
                  placeholder="https://github.com/owner/repository"
                  className="w-full bg-cyber-darker border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan/60 focus:glow transition-all duration-200" />
                <button onClick={handleTrack} disabled={tracking}
                  className="w-full px-6 py-3 rounded-lg font-semibold text-sm tracking-wider uppercase bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/20 hover:border-cyber-cyan/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 glow">
                  {tracking ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-cyber-cyan/30 border-t-cyber-cyan animate-spin" />
                      Analyzing...
                    </span>
                  ) : "Track Latest Release"}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="glass rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-cyber-darker/50 border-b border-cyber-border">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyber-red" />
                  <span className="w-2.5 h-2.5 rounded-full bg-cyber-amber" />
                  <span className="w-2.5 h-2.5 rounded-full bg-cyber-emerald" />
                  <span className="ml-2 text-xs text-cyber-muted uppercase tracking-wider">Console</span>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-cyber-muted/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse" />LIVE
                </span>
              </div>
              <div ref={consoleRef} className="h-64 overflow-y-auto p-4 bg-cyber-darker/30 font-mono text-xs leading-relaxed space-y-1">
                {logs.length === 0 && <span className="text-cyber-muted/40 italic">Waiting for activity...</span>}
                {logs.map((entry, i) => (
                  <div key={i} className="animate-fade-in">
                    <span className="text-cyber-muted/50">[{entry.ts}]</span>{" "}
                    <span className={
                      entry.type === "ok" ? "text-cyber-emerald"
                        : entry.type === "err" ? "text-cyber-red"
                          : entry.type === "warn" ? "text-cyber-amber"
                            : "text-cyber-cyan"
                    }>{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-cyber-text uppercase tracking-wider">Latest Result</span>
                {latestResult && (
                  <span className="text-[10px] text-cyber-emerald px-2 py-0.5 rounded-full bg-cyber-emerald/10 border border-cyber-emerald/20">
                    {latestResult.update?.release_tag}
                  </span>
                )}
              </div>
              <pre className="text-xs text-cyber-text leading-relaxed overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap font-mono">
                {latestResult ? JSON.stringify(latestResult, null, 2) : "No results yet. Track a repository to see output here."}
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-8 glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-semibold text-cyber-text uppercase tracking-wider">History</span>
            <button onClick={loadHistory} className="px-4 py-1.5 text-xs rounded-lg border border-cyber-border text-cyber-muted hover:border-cyber-cyan/40 hover:text-cyber-cyan transition-all duration-200">Refresh</button>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 opacity-20">⎔</div>
              <p className="text-sm text-cyber-muted italic">No records yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-cyber-border">
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Tracked At</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Repository</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Release</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Provider</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Breaking</th>
                    <th className="text-left py-2.5 pr-4 text-cyber-muted uppercase tracking-wider font-medium">Features</th>
                    <th className="text-left py-2.5 text-cyber-muted uppercase tracking-wider font-medium">Deprecations</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i} className="border-b border-cyber-border/40 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 pr-4 text-cyber-muted whitespace-nowrap">{formatDate(r.tracked_at)}</td>
                      <td className="py-2.5 pr-4"><a href={r.github_url || "#"} target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline">{r.owner}/{r.repo_name}</a></td>
                      <td className="py-2.5 pr-4 text-cyber-amber whitespace-nowrap">{r.release_tag}</td>
                      <td className="py-2.5 pr-4 text-cyber-muted">{r.provider_used}</td>
                      <td className="py-2.5 pr-4">{renderList(r.ai_analysis?.breaking_changes)}</td>
                      <td className="py-2.5 pr-4">{renderList(r.ai_analysis?.new_features)}</td>
                      <td className="py-2.5">{renderList(r.ai_analysis?.deprecations)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-cyber-border/30 py-6 px-4">
        <div className="max-w-7xl mx-auto text-center text-xs text-cyber-muted/40">
          BYOK · AI-Powered Dependency Intelligence · SpecTrack MVP
        </div>
      </footer>
    </div>
  );
}
