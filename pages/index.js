import { useState, useRef, useCallback } from "react";
import Head from "next/head";

function severityColor(severity) {
  if (severity === "high")   return "bg-red-50 border-red-200 text-red-800";
  if (severity === "medium") return "bg-amber-50 border-amber-200 text-amber-800";
  return "bg-green-50 border-green-200 text-green-800";
}

function severityBadge(severity) {
  if (severity === "high")   return "bg-red-100 text-red-700";
  if (severity === "medium") return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

function VerdictBanner({ verdict, reason }) {
  const styles = {
    SAFE:   { bg: "bg-emerald-50 border-emerald-300", icon: "✅", text: "text-emerald-800", label: "Safe to Sign" },
    REVIEW: { bg: "bg-amber-50 border-amber-300",     icon: "⚠️", text: "text-amber-800",   label: "Review Carefully" },
    LAWYER: { bg: "bg-red-50 border-red-300",          icon: "🚨", text: "text-red-800",     label: "Get a Lawyer" },
  };
  const s = styles[verdict] || styles.REVIEW;
  return (
    <div className={`rounded-xl border-2 p-4 ${s.bg} flex items-start gap-3`}>
      <span className="text-2xl">{s.icon}</span>
      <div>
        <p className={`font-bold text-lg ${s.text}`}>{s.label}</p>
        <p className={`text-sm mt-0.5 ${s.text} opacity-80`}>{reason}</p>
      </div>
    </div>
  );
}

function Section({ title, icon, children, count }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 flex items-center gap-2">
          <span>{icon}</span> {title}
          {count !== undefined && (
            <span className="ml-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">{count}</span>
          )}
        </span>
        <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-5 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function EmptyState({ message }) {
  return <p className="text-sm text-slate-400 italic py-1">{message}</p>;
}

export default function Home() {
  const [state, setState]           = useState("upload");
  const [dragOver, setDragOver]     = useState(false);
  const [error, setError]           = useState(null);
  const [analysis, setAnalysis]     = useState(null);
  const [contractText, setContractText] = useState("");
  const [email, setEmail]           = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef   = useRef(null);
  const fileInputRef = useRef(null);

  const submitEmail = useCallback(async () => {
    if (!email || !email.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setEmailSubmitted(true);
  }, [email]);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    const allowedExt = [".pdf", ".docx", ".txt"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowedExt.includes(ext)) {
      setError("Unsupported file. Please upload a PDF, Word (.docx), or text file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10 MB.");
      return;
    }
    setError(null);
    setState("loading");
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileData: base64, fileName: file.name, fileType: file.type }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Analysis failed.");
        setAnalysis(data.analysis);
        setContractText(data.contractText);
        setChatHistory([]);
        setState("results");
      } catch (err) {
        setError(err.message);
        setState("upload");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const onFileChange = useCallback((e) => { processFile(e.target.files[0]); }, [processFile]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatLoading(true);
    setChatHistory((h) => [...h, { role: "user", content: question }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, contractText, history: chatHistory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChatHistory((h) => [...h, { role: "assistant", content: data.answer }]);
    } catch {
      setChatHistory((h) => [...h, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const reset = () => {
    setState("upload"); setAnalysis(null); setContractText("");
    setChatHistory([]); setError(null); setEmailSubmitted(false); setEmail("");
  };

  return (
    <>
      <Head>
        <title>ClearSign — Understand Any Contract in Seconds</title>
        <meta name="description" content="Upload any contract and get a plain-English breakdown in any language — instantly." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="font-bold text-xl text-slate-900">ClearSign</span>
          </div>
          {state === "results" && (
            <button onClick={reset} className="text-sm text-slate-500 hover:text-slate-800 underline transition-colors">
              Analyse another contract
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-full">
            <span>🔒</span><span>Your file is never saved</span>
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-4 py-10">

          {/* UPLOAD */}
          {state === "upload" && (
            <div className="fade-in text-center">
              <h1 className="text-4xl font-bold text-slate-900 mb-3">
                Understand any contract<br />in seconds
              </h1>
              <p className="text-slate-500 text-lg mb-4">
                Upload a contract and we'll explain exactly what you're agreeing to —<br />
                <span className="font-medium text-slate-700">in plain English, Spanish, French, or any language you need.</span>
              </p>

              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-2.5 rounded-full mb-8">
                <span>🔒</span>
                <span>Your document is read, analysed, and immediately discarded — never saved, never shared with anyone.</span>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-14 cursor-pointer transition-all
                  ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"}`}
              >
                <div className="text-5xl mb-4">📂</div>
                <p className="text-slate-700 font-semibold text-lg">Drag & drop your contract here</p>
                <p className="text-slate-400 text-sm mt-1">or click to browse — PDF, Word (.docx), or plain text</p>
                <p className="text-slate-400 text-xs mt-3">Max 10 MB · Any language</p>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={onFileChange} />
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
              )}

              <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-slate-500">
                <span>🤖 Powered by Claude AI</span>
                <span>⚡ Results in under 30 seconds</span>
                <span>🌍 Works in any language</span>
              </div>

              <div className="mt-8 text-left bg-white border border-slate-200 rounded-2xl p-6">
                <p className="font-semibold text-slate-700 mb-3">Works great for:</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                  {["🏠 Rental & lease agreements","💼 Employment contracts","🤝 NDAs & confidentiality agreements","🛒 Terms of service","🧑‍💻 Freelance & service agreements","🏢 Business contracts"].map((item) => (
                    <div key={item} className="flex items-center gap-2 py-1">{item}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LOADING */}
          {state === "loading" && (
            <div className="fade-in flex flex-col items-center justify-center py-16">
              <div className="pulse-ring w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
                <span className="text-4xl">📄</span>
              </div>
              <p className="text-xl font-semibold text-slate-700">Reading your contract…</p>
              <p className="text-slate-400 text-sm mt-2">This usually takes 10–20 seconds</p>
              <div className="mt-4 flex gap-1">
                {[0,1,2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-blue-400"
                    style={{ animation: `pulse-ring 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>

              <div className="mt-10 w-full max-w-sm">
                {!emailSubmitted ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <p className="font-semibold text-slate-800 text-sm mb-1">📬 Get early access updates</p>
                    <p className="text-slate-400 text-xs mb-4">We're just launching. Drop your email and we'll keep you posted — no spam, ever.</p>
                    <div className="flex gap-2">
                      <input
                        type="email" value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                        onKeyDown={(e) => e.key === "Enter" && submitEmail()}
                        placeholder="your@email.com"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button onClick={submitEmail} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap">
                        Notify me
                      </button>
                    </div>
                    {emailError && <p className="text-red-500 text-xs mt-2">{emailError}</p>}
                    <p className="text-slate-300 text-xs mt-3 text-center">or skip — your results will appear automatically</p>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                    <span className="text-2xl">🎉</span>
                    <p className="text-emerald-700 font-semibold text-sm mt-2">You're on the list!</p>
                    <p className="text-emerald-600 text-xs mt-1">We'll be in touch. Your analysis is almost ready…</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RESULTS */}
          {state === "results" && analysis && (
            <div className="fade-in space-y-5">
              <div className="flex items-center justify-between">
                <span className="bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
                  {analysis.type || "Contract"}
                </span>
                <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-700 transition-colors">← New analysis</button>
              </div>

              <VerdictBanner verdict={analysis.verdict} reason={analysis.verdict_reason} />

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="font-semibold text-slate-800 mb-2">📋 Plain English Summary</p>
                <p className="text-slate-600 text-sm leading-relaxed">{analysis.summary}</p>
              </div>

              <Section title="Red Flags" icon="🚨" count={analysis.red_flags?.length || 0}>
                {!analysis.red_flags?.length ? <EmptyState message="No major red flags found." /> :
                  analysis.red_flags.map((f, i) => (
                    <div key={i} className={`rounded-lg border p-4 ${severityColor(f.severity)}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${severityBadge(f.severity)}`}>{f.severity}</span>
                        <span className="font-semibold text-sm">{f.flag}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{f.explanation}</p>
                    </div>
                  ))}
              </Section>

              <Section title="Your Obligations" icon="📌" count={analysis.obligations?.length || 0}>
                {!analysis.obligations?.length ? <EmptyState message="No specific obligations identified." /> :
                  analysis.obligations.map((o, i) => (
                    <div key={i} className={`rounded-lg border p-4 ${severityColor(o.severity)}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${severityBadge(o.severity)}`}>{o.severity}</span>
                        <span className="font-semibold text-sm">{o.title}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{o.description}</p>
                    </div>
                  ))}
              </Section>

              <Section title="Key Deadlines" icon="📅" count={analysis.deadlines?.length || 0}>
                {!analysis.deadlines?.length ? <EmptyState message="No specific deadlines found." /> :
                  analysis.deadlines.map((d, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm text-slate-800">{d.event}</span>
                        <span className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded whitespace-nowrap">{d.date}</span>
                      </div>
                      {d.consequence && <p className="text-xs text-slate-500 mt-1">If missed: {d.consequence}</p>}
                    </div>
                  ))}
              </Section>

              <Section title="Rights You're Waiving" icon="⚠️" count={analysis.rights_waived?.length || 0}>
                {!analysis.rights_waived?.length ? <EmptyState message="No significant rights being waived." /> :
                  analysis.rights_waived.map((r, i) => (
                    <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <p className="font-semibold text-sm text-amber-800 mb-1">{r.right}</p>
                      <p className="text-sm text-amber-700 leading-relaxed">{r.explanation}</p>
                    </div>
                  ))}
              </Section>

              <Section title="Auto-Renewals" icon="🔄" count={analysis.auto_renewals?.length || 0}>
                {!analysis.auto_renewals?.length ? <EmptyState message="No auto-renewal clauses found." /> :
                  analysis.auto_renewals.map((a, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="font-semibold text-sm text-slate-800 mb-1">{a.description}</p>
                      <p className="text-xs text-slate-500">Notice required to cancel: {a.notice_period}</p>
                    </div>
                  ))}
              </Section>

              {!emailSubmitted && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                  <p className="font-semibold text-blue-800 text-sm mb-1">📬 Want updates as we improve ClearSign?</p>
                  <p className="text-blue-600 text-xs mb-4">We're just getting started. Leave your email and we'll let you know about new features.</p>
                  <div className="flex gap-2">
                    <input type="email" value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                      onKeyDown={(e) => e.key === "Enter" && submitEmail()}
                      placeholder="your@email.com"
                      className="flex-1 border border-blue-200 bg-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={submitEmail} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap">
                      Notify me
                    </button>
                  </div>
                  {emailError && <p className="text-red-500 text-xs mt-2">{emailError}</p>}
                </div>
              )}

              {emailSubmitted && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                  <p className="text-emerald-700 font-semibold text-sm">🎉 You're on the list — thanks!</p>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <p className="font-semibold text-slate-800">💬 Ask a follow-up question</p>
                  <p className="text-xs text-slate-400 mt-0.5">"What does clause 7 mean?" · "Can I negotiate this?" · ask in any language</p>
                </div>
                {chatHistory.length > 0 && (
                  <div className="px-5 py-4 space-y-4 max-h-72 overflow-y-auto">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-sm rounded-xl px-4 py-3 text-sm leading-relaxed
                          ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 rounded-xl px-4 py-3 text-sm text-slate-500 italic">Thinking…</div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
                <div className="px-4 py-3 flex gap-2 border-t border-slate-100">
                  <input type="text" value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    placeholder="Ask anything about this contract…"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={chatLoading}
                  />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors">
                    Send
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center pb-8">
                ClearSign provides general information only — not legal advice. For important contracts, always consult a qualified lawyer.
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
