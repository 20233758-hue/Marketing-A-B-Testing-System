import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ExperimentCard from "../components/ExperimentCard.jsx";

const emptyVariant = () => ({ name: "", content: "" });

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [variants, setVariants] = useState([
    { name: "Control", content: "" },
    { name: "Variant B", content: "" },
  ]);

  const loadExperiments = useCallback(async () => {
    try {
      const result = await api("/experiments");
      setExperiments(result.experiments);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadExperiments(); }, [loadExperiments]);

  async function createExperiment(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/experiments", {
        method: "POST",
        body: JSON.stringify({ title, hypothesis, status: "running", variants }),
      });
      setTitle("");
      setHypothesis("");
      setVariants([{ name: "Control", content: "" }, { name: "Variant B", content: "" }]);
      setShowForm(false);
      setNotice("Experiment created.");
      await loadExperiments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function promoteWinner(experimentId, variantId) {
    setBusy(true);
    setError("");
    try {
      await api(`/experiments/${experimentId}/conclude`, {
        method: "POST",
        body: JSON.stringify({ variantId }),
      });
      setNotice("Winning variant promoted and experiment completed.");
      await loadExperiments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteExperiment(experimentId) {
    if (!window.confirm("Delete this experiment and its event history?")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/experiments/${experimentId}`, { method: "DELETE" });
      setExperiments((current) => current.filter((experiment) => experiment.id !== experimentId));
      setNotice("Experiment deleted.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function updateVariant(index, field, value) {
    setVariants((current) => current.map((variant, currentIndex) =>
      currentIndex === index ? { ...variant, [field]: value } : variant
    ));
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" className="text-sm font-bold tracking-wide text-indigo-600">EXPERIMENT STUDIO</a>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.email}</span>
            <button className="button-quiet" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Testing overview</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Your experiments</h1>
            <p className="mt-2 text-sm text-slate-500">Compare variants and make confident, data-informed decisions.</p>
          </div>
          <button className="button-primary" onClick={() => setShowForm((visible) => !visible)}>
            {showForm ? "Cancel" : "New experiment"}
          </button>
        </div>

        {error && <p role="alert" className="mt-6 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

        {showForm && (
          <form onSubmit={createExperiment} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Create an experiment</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Experiment title
                <input className="input-field mt-2" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Hypothesis
                <input className="input-field mt-2" value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} required />
              </label>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {variants.map((variant, index) => (
                <fieldset key={index} className="rounded-xl border border-slate-200 p-4">
                  <legend className="px-1 text-sm font-medium text-slate-700">Variant {index + 1}</legend>
                  <input className="input-field" aria-label={`Variant ${index + 1} name`} placeholder="Name" value={variant.name} onChange={(event) => updateVariant(index, "name", event.target.value)} required />
                  <textarea className="input-field mt-3 min-h-24 resize-y" aria-label={`Variant ${index + 1} content`} placeholder="Content or description" value={variant.content} onChange={(event) => updateVariant(index, "content", event.target.value)} required />
                </fieldset>
              ))}
            </div>
            <button className="button-primary mt-5" disabled={busy}>Create experiment</button>
          </form>
        )}

        {loading ? (
          <p className="mt-10 text-sm text-slate-500">Loading experiments…</p>
        ) : experiments.length ? (
          <div className="mt-8 space-y-5">
            {experiments.map((experiment) => (
              <ExperimentCard key={experiment.id} experiment={experiment} busy={busy} onPromote={promoteWinner} onDelete={deleteExperiment} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <h2 className="text-lg font-semibold text-slate-900">No experiments yet</h2>
            <p className="mt-2 text-sm text-slate-500">Create your first experiment to start comparing ideas.</p>
          </div>
        )}
      </div>
    </main>
  );
}
