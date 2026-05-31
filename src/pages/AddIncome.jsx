import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const today = new Date().toISOString().split('T')[0]

export default function AddIncome() {
  const [activeTab, setActiveTab] = useState('unique')
  const [split, setSplit] = useState({ retirement: 10, savings: 35, spending: 55 })
  const [form, setForm] = useState({
    date: today, amount: '', type: 'variable', source: '', description: '',
    employer_contribution: '', employer_contribution_note: '',
  })
  const [etaléForm, setEtaléForm] = useState({
    date: today, montant_total: '', source: '', nb_periodes: '',
    frequence: 'bihebdomadaire', description: ''
  })
  const [status, setStatus] = useState(null)
  const [preview, setPreview] = useState(null)
  const [etaléPreview, setEtaléPreview] = useState(null)
  const [etaléConfirmed, setEtaléConfirmed] = useState(false)

  useEffect(() => {
    async function fetchSplit() {
      const { data } = await supabase.from('split_config').select('*')
        .lte('valid_from', today).order('valid_from', { ascending: false }).limit(1)
      if (data && data.length > 0) {
        setSplit({ retirement: data[0].pct_retirement, savings: data[0].pct_savings, spending: data[0].pct_spending })
      }
    }
    fetchSplit()
  }, [])

  // --- Revenu unique ---
  function handleChange(e) {
    const { name, value } = e.target
    const updated = { ...form, [name]: value }
    setForm(updated)
    if (updated.amount && parseFloat(updated.amount) > 0) {
      const amt = parseFloat(updated.amount)
      setPreview({
        retirement: (amt * split.retirement / 100).toFixed(2),
        savings: (amt * split.savings / 100).toFixed(2),
        spending: (amt * split.spending / 100).toFixed(2),
      })
    } else setPreview(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('saving')
    const amt = parseFloat(form.amount)
    const { error } = await supabase.from('income').insert([{
      date: form.date, amount: amt, type: form.type, source: form.source,
      description: form.description,
      split_retirement: amt * split.retirement / 100,
      split_savings: amt * split.savings / 100,
      split_spending: amt * split.spending / 100,
      employer_contribution: form.employer_contribution ? parseFloat(form.employer_contribution) : 0,
      employer_contribution_note: form.employer_contribution_note || null,
    }])
    if (error) { setStatus('error'); console.error(error) }
    else {
      setStatus('success')
      setForm({ date: today, amount: '', type: 'variable', source: '', description: '', employer_contribution: '', employer_contribution_note: '' })
      setPreview(null)
    }
  }

  // --- Revenu étalé ---
  function genererDates(dateDebut, nbPeriodes, frequence) {
    const dates = []
    const d = new Date(dateDebut)
    for (let i = 0; i < nbPeriodes; i++) {
      dates.push(new Date(d).toISOString().split('T')[0])
      if (frequence === 'bihebdomadaire') d.setDate(d.getDate() + 14)
      else if (frequence === 'mensuel') d.setMonth(d.getMonth() + 1)
      else if (frequence === 'hebdomadaire') d.setDate(d.getDate() + 7)
    }
    return dates
  }

  function handleEtaléChange(e) {
    const { name, value } = e.target
    const updated = { ...etaléForm, [name]: value }
    setEtaléForm(updated)
    setEtaléConfirmed(false)
    setEtaléPreview(null)

    const { montant_total, nb_periodes, frequence, date } = updated
    if (montant_total && nb_periodes && parseFloat(montant_total) > 0 && parseInt(nb_periodes) > 0) {
      const montantParPeriode = parseFloat(montant_total) / parseInt(nb_periodes)
      const dates = genererDates(date, parseInt(nb_periodes), frequence)
      setEtaléPreview({
        montantParPeriode: montantParPeriode.toFixed(2),
        dates,
        retirement: (montantParPeriode * split.retirement / 100).toFixed(2),
        savings: (montantParPeriode * split.savings / 100).toFixed(2),
        spending: (montantParPeriode * split.spending / 100).toFixed(2),
      })
    }
  }

  async function handleEtaléSubmit() {
    setStatus('saving')
    const { data: { user } } = await supabase.auth.getUser()
    const montantParPeriode = parseFloat(etaléForm.montant_total) / parseInt(etaléForm.nb_periodes)
    const dates = genererDates(etaléForm.date, parseInt(etaléForm.nb_periodes), etaléForm.frequence)

    const rows = dates.map(date => ({
      date,
      amount: montantParPeriode,
      type: 'fixed',
      source: etaléForm.source,
      description: etaléForm.description || null,
      split_retirement: montantParPeriode * split.retirement / 100,
      split_savings: montantParPeriode * split.savings / 100,
      split_spending: montantParPeriode * split.spending / 100,
      employer_contribution: 0,
      employer_contribution_note: null,
    }))

    const { error } = await supabase.from('income').insert(rows)
    if (error) { setStatus('error'); console.error(error) }
    else {
      setStatus('success')
      setEtaléForm({ date: today, montant_total: '', source: '', nb_periodes: '', frequence: 'bihebdomadaire', description: '' })
      setEtaléPreview(null)
      setEtaléConfirmed(false)
    }
  }

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400"

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Nouveau revenu</h1>

      <div className="flex gap-2 mb-4">
        {[['unique', 'Revenu unique'], ['etale', 'Revenu étalé']].map(([key, label]) => (
          <button key={key} onClick={() => { setActiveTab(key); setStatus(null) }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        {activeTab === 'unique' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
                <input type="date" name="date" value={form.date} onChange={handleChange} className={inputCls} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Montant net ($)</label>
                <input type="number" name="amount" value={form.amount} onChange={handleChange}
                  placeholder="0.00" step="0.01" min="0" className={`${inputCls} text-right`} required />
              </div>
            </div>

            {preview && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Répartition automatique</p>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm"><span className="text-slate-600">🏦 Retraite ({split.retirement}%)</span><span className="font-semibold text-slate-800">{parseFloat(preview.retirement).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">💰 Épargne ({split.savings}%)</span><span className="font-semibold text-slate-800">{parseFloat(preview.savings).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">🛒 Dépenses ({split.spending}%)</span><span className="font-semibold text-slate-800">{parseFloat(preview.spending).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span></div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
              <select name="type" value={form.type} onChange={handleChange} className={inputCls}>
                <option value="fixed">Fixe (chômage, indemnité)</option>
                <option value="variable">Variable (consultation)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Source</label>
              <input type="text" name="source" value={form.source} onChange={handleChange}
                placeholder="Ex: Chômage, Consultation XYZ" className={inputCls} required />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contribution employeur (optionnel)</p>
              <div className="flex flex-col gap-2">
                <input type="number" name="employer_contribution" value={form.employer_contribution}
                  onChange={handleChange} placeholder="Montant ($)" step="0.01" min="0" className={`${inputCls} text-right`} />
                <input type="text" name="employer_contribution_note" value={form.employer_contribution_note}
                  onChange={handleChange} placeholder="Ex: Match REER VIA 7%" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
              <input type="text" name="description" value={form.description} onChange={handleChange} className={inputCls} />
            </div>

            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors mt-1">
              {status === 'saving' ? 'Enregistrement...' : 'Enregistrer le revenu'}
            </button>
            {status === 'success' && <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-sm text-emerald-700 text-center">✓ Revenu enregistré</div>}
            {status === 'error' && <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-sm text-red-600 text-center">Erreur — voir console</div>}
          </form>
        )}

        {activeTab === 'etale' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date de début</label>
              <input type="date" name="date" value={etaléForm.date} onChange={handleEtaléChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Montant total reçu ($)</label>
              <input type="number" name="montant_total" value={etaléForm.montant_total} onChange={handleEtaléChange}
                placeholder="0.00" step="0.01" min="0" className={`${inputCls} text-right`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Source</label>
              <input type="text" name="source" value={etaléForm.source} onChange={handleEtaléChange}
                placeholder="Ex: Indemnité de départ VIA" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nb de périodes</label>
                <input type="number" name="nb_periodes" value={etaléForm.nb_periodes} onChange={handleEtaléChange}
                  placeholder="26" min="1" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fréquence</label>
                <select name="frequence" value={etaléForm.frequence} onChange={handleEtaléChange} className={inputCls}>
                  <option value="hebdomadaire">Hebdomadaire</option>
                  <option value="bihebdomadaire">Aux 2 semaines</option>
                  <option value="mensuel">Mensuel</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
              <input type="text" name="description" value={etaléForm.description} onChange={handleEtaléChange} className={inputCls} />
            </div>

            {etaléPreview && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-3">
                <p className="font-semibold text-amber-800 text-sm">Aperçu — {etaléPreview.dates.length} entrées à créer</p>
                <div className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600">Par période</span><span className="font-bold text-slate-800">{parseFloat(etaléPreview.montantParPeriode).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">🏦 Retraite ({split.retirement}%)</span><span className="text-slate-700">{parseFloat(etaléPreview.retirement).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">💰 Épargne ({split.savings}%)</span><span className="text-slate-700">{parseFloat(etaléPreview.savings).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">🛒 Dépenses ({split.spending}%)</span><span className="text-slate-700">{parseFloat(etaléPreview.spending).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span></div>
                </div>
                <div className="border-t border-amber-200 pt-2 max-h-36 overflow-y-auto">
                  <p className="text-xs text-amber-700 font-medium mb-1">Dates générées :</p>
                  {etaléPreview.dates.map((d, i) => (
                    <div key={i} className="text-xs text-slate-600 flex justify-between py-0.5">
                      <span>Période {i + 1}</span><span>{d}</span>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={etaléConfirmed} onChange={e => setEtaléConfirmed(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                  <span className="text-slate-600">Je confirme la création de {etaléPreview.dates.length} entrées</span>
                </label>
                <button onClick={handleEtaléSubmit} disabled={!etaléConfirmed || status === 'saving'}
                  className={`w-full py-3 rounded-xl font-semibold text-sm text-white transition-colors ${etaléConfirmed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed'}`}>
                  {status === 'saving' ? 'Création en cours...' : 'Créer toutes les entrées'}
                </button>
              </div>
            )}
            {status === 'success' && <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-sm text-emerald-700 text-center">✓ Entrées créées</div>}
            {status === 'error' && <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-sm text-red-600 text-center">Erreur — voir console</div>}
          </div>
        )}
      </div>
    </div>
  )
}