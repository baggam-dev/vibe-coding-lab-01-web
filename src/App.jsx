import { useEffect, useMemo, useState } from "react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label className="text-sm font-medium text-slate-800">{label}</label>
        {required && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200">
            필수
          </span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-700/70">{hint}</p>}
    </div>
  );
}

function Fireflies() {
  // 위치/속도 랜덤처럼 보이게 하드코딩(리렌더 영향 최소)
  const dots = [
    { left: "12%", top: "18%", d: "7.5s", delay: "0.2s" },
    { left: "24%", top: "68%", d: "9.2s", delay: "0.9s" },
    { left: "38%", top: "30%", d: "8.1s", delay: "0.4s" },
    { left: "55%", top: "20%", d: "10.2s", delay: "1.3s" },
    { left: "62%", top: "74%", d: "8.8s", delay: "0.1s" },
    { left: "78%", top: "34%", d: "9.6s", delay: "0.6s" },
    { left: "86%", top: "64%", d: "11.0s", delay: "1.1s" },
    { left: "92%", top: "22%", d: "8.4s", delay: "0.3s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      {dots.map((p, i) => (
        <span
          key={i}
          className="firefly"
          style={{
            left: p.left,
            top: p.top,
            ["--d"]: p.d,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

  const [form, setForm] = useState({
    name: "",
    age: "",
    setting: "",
    tone: "따뜻한",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [story, setStory] = useState("");
  const [displayStory, setDisplayStory] = useState("");
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    // story가 바뀌면 "한 줄씩" 타자기처럼 출력
    if (!story) {
      setDisplayStory("");
      setTyping(false);
      return;
    }

    const lines = story.split("\n");
    let i = 0;
    let cancelled = false;

    setDisplayStory("");
    setTyping(true);

    const tick = () => {
      if (cancelled) return;

      i += 1;
      setDisplayStory(lines.slice(0, i).join("\n"));

      if (i >= lines.length) {
        setTyping(false);
        return;
      }

      // 줄마다 약간 랜덤한 리듬(게임 느낌)
      const delay = 220 + Math.floor(Math.random() * 120);
      setTimeout(tick, delay);
    };

    // 첫 줄 빠르게 시작
    const startDelay = 120;
    const t = setTimeout(tick, startDelay);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [story]);

  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [spark, setSpark] = useState(false); // 촛불+빛 번짐 트리거

  const prompt = useMemo(() => {
    const name = form.name.trim() || "이름 없는 주인공";
    const age = form.age.trim() ? `${form.age}살` : "나이 미상";
    const setting = form.setting.trim() || "어딘가의 작은 마을";
    const tone = form.tone || "따뜻한";

    return `
당신은 어린이를 위한 동화 작가입니다.
아래 정보를 바탕으로 동화 '도입부'만 정확히 5줄로 써주세요.
각 줄은 줄바꿈으로 구분하고, 5줄을 넘기지 마세요.
불필요한 제목/머리말/설명 없이 본문만 출력하세요.

- 주인공: ${name} (${age})
- 배경: ${setting}
- 분위기: ${tone}
`.trim();
  }, [form]);

  const canSubmit = Boolean(API_BASE) && form.name.trim() && form.setting.trim() && !loading;

  async function handleGenerate() {
    setError("");
    setStory("");
    setCopied(false);
    setLoading(true);

    try {
      const url = `${API_BASE}/generate?ts=${Date.now()}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify({ prompt }),
      });

      if (res.status === 204 || res.status === 304) {
        throw new Error(`본문 없는 응답(status=${res.status})`);
      }

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const raw = await res.text().catch(() => "");
        throw new Error(
          `JSON 응답이 아닙니다. status=${res.status}, content-type=${ct || "null"}, body=${raw.slice(0, 120)}`
        );
      }

      const raw = await res.text();
      if (!raw) {
        throw new Error(
          `API 응답이 비어있습니다. status=${res.status}, content-type=${ct || "null"}`
        );
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`JSON 파싱 실패: ${raw.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `API 오류 (${res.status})`);
      }

      setStory(String(data.story ?? data.text ?? "").trim());

      // 촛불 깜빡임 + 결과 빛 번짐(짧게)
      setSpark(true);
      setTimeout(() => setSpark(false), 650);
    } catch (e) {
      setError(e?.message || "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!story) return;
    try {
      await navigator.clipboard.writeText(story);
      setCopied(true);
      setShowToast(true);

      setTimeout(() => {
        setShowToast(false);
        setCopied(false);
      }, 1200);
    } catch {
      // 무시
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1410] text-slate-100 forest-noise">
      {/* 숲 배경 레이어 */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#07110c] via-[#0b1a12] to-[#0a120e]" />
        <div className="absolute -top-24 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-[999px] bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-140px] left-[-120px] h-[420px] w-[520px] rounded-[999px] bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-140px] h-[520px] w-[620px] rounded-[999px] bg-lime-300/10 blur-3xl" />
      </div>

      {/* 반딧불 */}
      <Fireflies />

      <div className="relative mx-auto max-w-5xl px-4 py-10">
        {/* 상단 “간판” */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-black/25 px-4 py-2 ring-1 ring-white/10 backdrop-blur sway">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.45)]" />
            <span className="text-sm font-semibold tracking-wide text-emerald-50/90">
              Vibe Coding Lab 01 · Cabin Story
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-amber-50">
            숲속 오두막 동화 도입부 생성기
          </h1>
          <p className="mt-2 text-sm text-emerald-50/70">
            변수 입력 → 촛불빛 양피지에 5줄 도입부를 적어드립니다.
          </p>
        </header>

        {!API_BASE && (
          <div className="mb-6 rounded-2xl bg-amber-200/10 p-4 text-amber-50 ring-1 ring-amber-200/30 backdrop-blur">
            <div className="font-semibold">환경변수 설정 필요</div>
            <div className="mt-1 text-sm text-amber-50/90">
              <code className="rounded bg-black/30 px-1 py-0.5 ring-1 ring-white/10">
                VITE_API_BASE_URL
              </code>
              이 비어있습니다.{" "}
              <code className="rounded bg-black/30 px-1 py-0.5 ring-1 ring-white/10">.env</code>{" "}
              또는 Render Static Site 환경변수에 백엔드 주소를 넣어주세요.
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* 입력 카드 (양피지) */}
          <section className="relative rounded-[1.25rem] p-6 text-slate-900 parchment pixel-border">
            <div className="relative">
              <div className={cx("candle-glow", spark && "flicker")} />
              <h2 className="text-lg font-extrabold text-[#2c1d10]">📜 입력</h2>
              <p className="mt-1 text-sm text-[#4b3420]/80">
                최소 필수값만 넣고 바로 시작해보세요.
              </p>

              <div className="mt-5 space-y-4">
                <Field label="주인공 이름" required hint="예: 준희, 민준, 루루">
                  <input
                    className="w-full rounded-xl border border-[#c9ab7a] bg-[#fff6df] px-3 py-2 outline-none focus:border-[#b88a52] focus:ring-4 focus:ring-amber-200/40"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="주인공 이름"
                  />
                </Field>

                <Field label="나이" hint="숫자만 입력해도 됩니다 (선택)">
                  <input
                    className="w-full rounded-xl border border-[#c9ab7a] bg-[#fff6df] px-3 py-2 outline-none focus:border-[#b88a52] focus:ring-4 focus:ring-amber-200/40"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    placeholder="예: 8"
                  />
                </Field>

                <Field label="배경" required hint="예: 비 오는 날의 학교 도서관">
                  <input
                    className="w-full rounded-xl border border-[#c9ab7a] bg-[#fff6df] px-3 py-2 outline-none focus:border-[#b88a52] focus:ring-4 focus:ring-amber-200/40"
                    value={form.setting}
                    onChange={(e) => setForm({ ...form, setting: e.target.value })}
                    placeholder="배경"
                  />
                </Field>

                <Field label="분위기" hint="분위기는 나중에 더 늘릴 수 있어요">
                  <select
                    className="w-full rounded-xl border border-[#c9ab7a] bg-[#fff6df] px-3 py-2 outline-none focus:border-[#b88a52] focus:ring-4 focus:ring-amber-200/40"
                    value={form.tone}
                    onChange={(e) => setForm({ ...form, tone: e.target.value })}
                  >
                    <option>따뜻한</option>
                    <option>미스터리한</option>
                    <option>코믹한</option>
                    <option>감동적인</option>
                    <option>판타지</option>
                  </select>
                </Field>

                <button
                  onClick={handleGenerate}
                  disabled={!canSubmit}
                  className={cx(
                    "game-btn mt-2 w-full rounded-xl px-4 py-2.5 font-extrabold text-[#fff7e6] ring-1 transition",
                    "shadow-[0_10px_24px_rgba(0,0,0,0.25)]",
                    canSubmit
                      ? "bg-[#4a2b14] ring-[#2c1d10] hover:bg-[#5a351a] active:translate-y-[1px]"
                      : "bg-[#7b6a5c] ring-[#6b5c52] opacity-60"
                  )}
                >
                  {loading ? "🕯️ 작성 중..." : "🪵 이야기 시작"}
                </button>

                <div className="text-xs text-[#4b3420]/80">
                  API:{" "}
                  <span className="rounded bg-black/10 px-1 py-0.5 ring-1 ring-black/10">
                    {API_BASE || "미설정"}
                  </span>
                </div>

                {error && (
                  <div className="rounded-xl bg-rose-100/70 p-3 text-sm text-rose-900 ring-1 ring-rose-200">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 결과 카드 (양피지 + 어두운 포커스) */}
          <section className="relative rounded-[1.25rem] p-6 parchment pixel-border text-slate-900">
            <div className="relative">
              <div className={cx("reveal-glow", spark && "play")} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-[#2c1d10]">🗒️ 결과</h2>
                  <p className="mt-1 text-sm text-[#4b3420]/80">
                    생성된 도입부를 복사하거나 다시 생성해보세요.
                  </p>
                </div>

                <button
                  onClick={handleCopy}
                  disabled={!story}
                  className={cx(
                    "game-btn rounded-xl px-3 py-2 text-sm font-extrabold ring-1 transition",
                    story
                      ? "bg-[#0f1a14] text-amber-50 ring-[#0b1410] hover:bg-[#13251b] active:translate-y-[1px]"
                      : "bg-black/10 text-[#4b3420]/40 ring-black/10"
                  )}
                >
                  {copied ? "✅ 복사됨!" : "📋 복사"}
                </button>
              </div>

              <div className="mt-5">
                {loading && (
                  <div className="space-y-3">
                    <div className="h-4 w-11/12 animate-pulse rounded bg-black/10" />
                    <div className="h-4 w-10/12 animate-pulse rounded bg-black/10" />
                    <div className="h-4 w-9/12 animate-pulse rounded bg-black/10" />
                    <div className="h-4 w-10/12 animate-pulse rounded bg-black/10" />
                    <div className="h-4 w-8/12 animate-pulse rounded bg-black/10" />
                  </div>
                )}

                {!loading && !story && (
                  <div className="rounded-xl bg-black/10 p-4 text-sm text-[#4b3420]/80 ring-1 ring-black/10">
                    아직 결과가 없습니다. 왼쪽에서 값을 입력하고 시작해보세요.
                  </div>
                )}

                {!loading && story && (
                  <pre className="whitespace-pre-wrap rounded-xl bg-black/10 p-4 text-sm leading-6 text-[#2c1d10] ring-1 ring-black/10">
                    {displayStory}
                    {typing && <span className="caret" />}
                  </pre>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-10 text-center text-xs text-emerald-50/55">
          숲속이 조용해지면… 반딧불이 글씨를 밝혀줍니다 ✨
        </footer>
      </div>
      {showToast && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div className="pixel-toast game-btn rounded-xl bg-[#2c1d10] px-4 py-2 text-sm font-extrabold text-amber-50 ring-1 ring-[#1a120a] shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
            📋 복사 완료!
          </div>
        </div>
      )}
    </div>
  );
}
