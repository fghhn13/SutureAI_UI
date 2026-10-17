import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, uploadWithProgress } from "../api/client.js";
import { TERMINAL_STATUSES } from "../api/sessionStatus.js";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import ProcessingPanel from "../components/ProcessingPanel.jsx";
import { durationLabel, statusLabel, taskDescription, taskName, useI18n } from "../i18n/index.js";

const POLL_MS = 1000;
const AUTO_OPEN_MS = 2500;
const ACCEPTED_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv"];

function formatBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function formatSeconds(s) {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function isAcceptedVideo(file) {
  const name = file.name.toLowerCase();
  return file.type.startsWith("video/") || ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** Read duration from the file's metadata in the browser (the backend has no ffprobe). */
function readVideoDuration(url) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => resolve(null);
    v.src = url;
  });
}

function TaskPicker({ tasks, selectedId, onSelect, disabled }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => {
        const active = task.id === selectedId;
        return (
          <button
            key={task.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(task.id)}
            aria-pressed={active}
            className={`rounded-xl border p-4 text-left transition-all duration-200 disabled:cursor-not-allowed ${
              active
                ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20"
                : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/40"
            }`}
          >
            <p className="font-semibold text-slate-900">{taskName(t, task.id, task.name)}</p>
            <p className="mt-1 text-xs text-slate-600">{taskDescription(t, task)}</p>
            <p className="mt-2 text-xs text-slate-500">
              {durationLabel(t, task.estimatedDuration)} ·{" "}
              {t("train.dimensionsCount", { count: task.dimensions.length })}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function VideoDropZone({ file, previewUrl, duration, onFile, disabled }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(files) {
    const f = files?.[0];
    if (f) onFile(f);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) pick(e.dataTransfer.files);
        }}
        className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60 hover:border-brand-300"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <p className="text-sm font-semibold text-slate-800">
          {file ? t("train.dropChange") : t("train.dropPrompt")}
        </p>
        <p className="mt-1 text-xs text-slate-500">{t("train.formats")}</p>
        <input
          ref={inputRef}
          type="file"
          accept={`video/*,${ACCEPTED_EXTENSIONS.join(",")}`}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {file ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <video
            src={previewUrl}
            controls
            muted
            className="aspect-video w-full rounded-lg bg-slate-900 object-contain"
          />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">{t("train.file")}</dt>
              <dd className="truncate font-medium text-slate-900" title={file.name}>
                {file.name}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">{t("train.size")}</dt>
              <dd className="text-slate-800">{formatBytes(file.size)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("train.duration")}</dt>
              <dd className="text-slate-800">{duration != null ? formatSeconds(duration) : "—"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export default function TrainingSessionPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [tasks, setTasks] = useState([]);
  const [taskId, setTaskId] = useState(searchParams.get("task") ?? "");
  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [duration, setDuration] = useState(null);
  const [fileError, setFileError] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [actionError, setActionError] = useState(null);
  const abortRef = useRef(null);
  // Id of the session this page created itself, so the URL effect does not refetch it.
  const createdIdRef = useRef(null);

  // Tasks (needed to start a new session).
  useEffect(() => {
    api("/tasks")
      .then((list) => {
        setTasks(list);
        setTaskId((cur) => (list.some((task) => task.id === cur) ? cur : list[0]?.id ?? ""));
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  // Existing session from the URL (e.g. after refresh, or opened from the dashboard).
  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return;
    }
    if (sessionId === createdIdRef.current) return;
    api(`/sessions/${sessionId}`)
      .then((s) => {
        setSession(s);
        setTaskId(s.task.id);
      })
      .catch((err) => setLoadError(err.message));
  }, [sessionId]);

  // Poll while the backend is working on it.
  const status = session?.status;
  useEffect(() => {
    if (!session || status === "created" || TERMINAL_STATUSES.has(status)) return undefined;
    const timer = setInterval(() => {
      api(`/sessions/${session.id}`)
        .then(setSession)
        .catch(() => {
          /* transient; keep polling */
        });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [session, status]);

  // Open the report automatically when processing finishes while the student watches.
  const sawProcessingRef = useRef(false);
  const [autoOpening, setAutoOpening] = useState(false);
  useEffect(() => {
    if (!session) return undefined;
    if (!TERMINAL_STATUSES.has(session.status) && session.status !== "created") {
      sawProcessingRef.current = true;
      return undefined;
    }
    if (session.status !== "ready" || !sawProcessingRef.current) return undefined;
    setAutoOpening(true);
    const id = setTimeout(
      () => navigate({ pathname: "/report", search: `?session=${encodeURIComponent(session.id)}` }),
      AUTO_OPEN_MS,
    );
    return () => clearTimeout(id);
  }, [session, navigate]);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleFile = useCallback(async (f) => {
    setFileError(null);
    if (!isAcceptedVideo(f)) {
      setFileError("train.notVideo"); // dictionary key, rendered with t()
      return;
    }
    const url = URL.createObjectURL(f);
    setFile(f);
    setPreviewUrl(url);
    setDuration(null);
    setDuration(await readVideoDuration(url));
  }, []);

  async function handleUpload() {
    if (!file || !taskId) return;
    setActionError(null);
    setUploading(true);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let current = session;
      if (!current) {
        current = await api("/sessions", { method: "POST", body: { taskId } });
        createdIdRef.current = current.id;
        setSession(current);
        // Same route element (optional :sessionId), so this does not remount the page.
        navigate(`/train/${current.id}`, { replace: true });
      }
      const form = new FormData();
      form.append("file", file);
      if (duration != null) form.append("durationSeconds", String(duration));
      const updated = await uploadWithProgress(`/sessions/${current.id}/video`, form, {
        onProgress: setProgress,
        signal: controller.signal,
      });
      setSession(updated);
    } catch (err) {
      if (err?.name !== "AbortError") setActionError(err.message);
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }

  async function handleRetry() {
    setActionError(null);
    try {
      setSession(await api(`/sessions/${session.id}/retry`, { method: "POST" }));
    } catch (err) {
      setActionError(err.message);
    }
  }

  function startAnother() {
    setSession(null);
    setFile(null);
    setPreviewUrl(null);
    setDuration(null);
    setProgress(0);
    setActionError(null);
    navigate(`/train?task=${encodeURIComponent(taskId)}`, { replace: true });
  }

  const needsUpload = !session || session.status === "created";
  const selectedTask = tasks.find((task) => task.id === taskId) ?? session?.task;

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Link to="/" className="link-brand text-sm">
          {t("train.backToDashboard")}
        </Link>
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <p className="font-semibold">{t("train.loadFailedTitle")}</p>
          <p className="mt-2 text-sm">{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="link-brand text-sm font-medium">
          {t("train.backToDashboard")}
        </Link>
        <LanguageSwitch />
      </div>

      <header className="surface-card mt-4 p-6">
        <p className="text-sm font-semibold tracking-wide text-brand-700">{t("common.appName")}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {needsUpload
            ? t("train.titleNew")
            : selectedTask
              ? taskName(t, selectedTask.id, selectedTask.name)
              : t("train.titleFallback")}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {needsUpload
            ? t("train.introNew")
            : t("train.statusLine", { status: statusLabel(t, session.status) })}
        </p>
      </header>

      {needsUpload ? (
        <>
          <section className="surface-card mt-6 p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("train.stepTask")}</h2>
            <div className="mt-4">
              {tasks.length ? (
                <TaskPicker
                  tasks={tasks}
                  selectedId={taskId}
                  onSelect={setTaskId}
                  disabled={uploading || Boolean(session)}
                />
              ) : (
                <p className="text-sm text-slate-500">{t("train.loadingTasks")}</p>
              )}
            </div>
          </section>

          <section className="surface-card mt-6 p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("train.stepRecording")}</h2>
            <div className="mt-4">
              <VideoDropZone
                file={file}
                previewUrl={previewUrl}
                duration={duration}
                onFile={handleFile}
                disabled={uploading}
              />
              {fileError ? (
                <p className="mt-3 text-sm text-rose-700" role="alert">
                  {t(fileError)}
                </p>
              ) : null}
            </div>
          </section>

          <section className="surface-card mt-6 p-6">
            {uploading ? (
              <div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-800">{t("train.uploading")}</span>
                  <span className="tabular-nums text-slate-600">{Math.round(progress * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="btn-secondary mt-4 px-4 py-2 text-sm"
                >
                  {t("train.cancelUpload")}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!file || !taskId}
                  onClick={handleUpload}
                  className="btn-primary"
                >
                  {t("train.uploadAnalyse")}
                </button>
                {!file ? <span className="text-sm text-slate-500">{t("train.chooseVideo")}</span> : null}
              </div>
            )}
            {actionError ? (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
                {actionError}
              </p>
            ) : null}
          </section>
        </>
      ) : (
        <section className="surface-card mt-6 p-6">
          <ProcessingPanel session={session} />

          {session.status === "ready" ? (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <p className="text-sm text-slate-700">
                {t("train.overallScore")}{" "}
                <span className="text-2xl font-bold text-brand-700">{session.overallScore}</span>
                <span className="text-slate-500"> {t("common.outOf100")}</span>
                {autoOpening ? <span className="ml-3 text-slate-500">{t("train.openingReport")}</span> : null}
              </p>
              <Link
                to={{ pathname: "/report", search: `?session=${encodeURIComponent(session.id)}` }}
                className="btn-primary inline-flex"
              >
                {t("train.viewReport")}
              </Link>
              <button type="button" onClick={startAnother} className="btn-secondary">
                {t("train.recordAnother")}
              </button>
            </div>
          ) : session.status === "failed" ? (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <p className="font-semibold">{t("train.failedTitle")}</p>
              <p className="mt-1 break-words">{session.error ?? t("train.unknownError")}</p>
              <button type="button" onClick={handleRetry} className="btn-primary mt-3 px-4 py-2">
                {t("train.retry")}
              </button>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-600">
              {t("train.leaveHint")}
            </p>
          )}

          {session.video ? (
            <p className="mt-6 text-xs text-slate-500">
              {session.video.originalFilename ?? t("train.video")} · {formatBytes(session.video.sizeBytes)}
              {session.video.durationS != null ? ` · ${formatSeconds(session.video.durationS)}` : ""}
            </p>
          ) : null}
          {actionError ? (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {actionError}
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
}
