import { useMemo, useState } from "react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {required && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
            필수
          </span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
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
  const [copied, setCopied] = useState(false);

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

      // (1) 상태 코드 먼저 방어
      if (res.status === 204 || res.status === 304) {
        throw new Error(`본문 없는 응답(status=${res.status})`);
      }

      // (2) content-type 확인 (OPTIONS/HTML/기타 방지)
      const ct = res.headers.get("content-type") || "";
      // JSON이 아니면 body를 텍스트로 읽어서 에러에 포함(디버그용)
      if (!ct.includes("application/json")) {
        const raw = await res.text().catch(() => "");
        throw new Error(
          `JSON 응답이 아닙니다. status=${res.status}, content-type=${ct || "null"}, body=${raw.slice(0, 120)}`
        );
      }

      // (3) 무조건 text로 받고, 비었으면 명확한 에러
      const raw = await res.text();
      if (!raw) {
        throw new Error(
          `API 응답이 비어있습니다. status=${res.status}, content-type=${ct || "null"}`
        );
      }

      // (4) JSON 파싱
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`JSON 파싱 실패: ${raw.slice(0, 120)}`);
      }

      // (5) HTTP 에러면 서버 메시지 보여주기
      if (!res.ok) {
        throw new Error(data?.error || `API 오류 (${res.status})`);
      }

      setStory(String(data.story ?? data.text ?? "").trim());
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
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // 무시
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm shadow-sm ring-1 ring-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Vibe Coding Lab 01</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">동화 도입부 생성기</h1>
          <p className="mt-2 text-slate-600">변수 입력 → 서버 호출 → 도입부 5줄 출력</p>
        </header>

        {!API_BASE && (
          <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
            <div className="font-semibold">환경변수 설정 필요</div>
            <div className="mt-1 text-sm">
              <code className="rounded bg-white px-1 py-0.5 ring-1 ring-amber-200">
                VITE_API_BASE_URL
              </code>
              이 비어있습니다. <code>.env</code>에 Render 서버 주소를 넣어주세요.
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* 입력 카드 */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold">입력</h2>
            <p className="mt-1 text-sm text-slate-600">최소 필수값만 넣고 바로 생성해보세요.</p>

            <div className="mt-5 space-y-4">
              <Field label="주인공 이름" required hint="예: 준희, 민준, 루루">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="주인공 이름"
                />
              </Field>

              <Field label="나이" hint="숫자만 입력해도 됩니다 (선택)">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="예: 8"
                />
              </Field>

              <Field label="배경" required hint="예: 비 오는 날의 학교 도서관">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                  value={form.setting}
                  onChange={(e) => setForm({ ...form, setting: e.target.value })}
                  placeholder="배경"
                />
              </Field>

              <Field label="분위기" hint="분위기는 나중에 더 늘릴 수 있어요">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
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
                  "mt-2 w-full rounded-xl px-4 py-2.5 font-semibold text-white shadow-sm transition",
                  canSubmit ? "bg-slate-900 hover:bg-slate-800 active:bg-slate-950" : "bg-slate-300"
                )}
              >
                {loading ? "생성 중..." : "도입부 생성"}
              </button>

              <div className="text-xs text-slate-500">
                API:{" "}
                <span className="rounded bg-slate-100 px-1 py-0.5 ring-1 ring-slate-200">
                  {API_BASE || "미설정"}
                </span>
              </div>

              {error && (
                <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-200">
                  {error}
                </div>
              )}
            </div>
          </section>

          {/* 결과 카드 */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">결과</h2>
                <p className="mt-1 text-sm text-slate-600">
                  생성된 도입부를 복사하거나 다시 생성해보세요.
                </p>
              </div>

              <button
                onClick={handleCopy}
                disabled={!story}
                className={cx(
                  "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                  story
                    ? "bg-slate-900 text-white ring-slate-900 hover:bg-slate-800"
                    : "bg-slate-100 text-slate-400 ring-slate-200"
                )}
              >
                {copied ? "복사됨!" : "복사"}
              </button>
            </div>

            <div className="mt-5">
              {loading && (
                <div className="space-y-3">
                  <div className="h-4 w-11/12 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-10/12 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-9/12 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-10/12 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-8/12 animate-pulse rounded bg-slate-100" />
                </div>
              )}

              {!loading && !story && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                  아직 결과가 없습니다. 왼쪽에서 값을 입력하고 생성해보세요.
                </div>
              )}

              {!loading && story && (
                <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-900 ring-1 ring-slate-200">
                  {story}
                </pre>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
