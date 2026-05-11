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

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Nouveau revenu</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[['unique', 'Revenu unique'], ['etale', 'Revenu étalé']].map(([key, label]) => (
          <button key={key} onClick={() => { setActiveTab(key); setStatus(null) }}
            className={`px-4 py-2 rounded-full text-sm font-medium ${activeTab === key ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Revenu unique */}
      {activeTab === 'unique' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" name="date" value={form.date} onChange={handleChange}
              className="w-full border rounded-lg p-3" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Montant net reçu ($)</label>
            <input type="number" name="amount" value={form.amount} onChange={handleChange}
              placeholder="0.00" step="0.01" min="0" className="w-full border rounded-lg p-3" required />
          </div>
          {preview && (
            <div className="bg-blue-50 rounded-lg p-4 flex flex-col gap-1">
              <p className="text-sm font-semibold text-blue-800 mb-1">Répartition automatique</p>
              <div className="flex justify-between text-sm"><span>🏦 Retraite ({split.retirement}%)</span><span className="font-medium">{preview.retirement} $</span></div>
              <div className="flex justify-between text-sm"><span>💰 Épargne ({split.savings}%)</span><span className="font-medium">{preview.savings} $</span></div>
              <div className="flex justify-between text-sm"><span>🛒 Dépenses ({split.spending}%)</span><span className="font-medium">{preview.spending} $</span></div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select name="type" value={form.type} onChange={handleChange} className="w-full border rounded-lg p-3">
              <option value="fixed">Fixe (chômage, indemnité)</option>
              <option value="variable">Variable (consultation)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Source</label>
            <input type="text" name="source" value={form.source} onChange={handleChange}
              placeholder="Ex: Chômage, Consultation XYZ" className="w-full border rounded-lg p-3" required />
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-600 mb-2">Contribution employeur (optionnel)</p>
            <div className="flex flex-col gap-2">
              <input type="number" name="employer_contribution" value={form.employer_contribution}
                onChange={handleChange} placeholder="Montant ($)" step="0.01" min="0" className="w-full border rounded-lg p-3" />
              <input type="text" name="employer_contribution_note" value={form.employer_contribution_note}
                onChange={handleChange} placeholder="Ex: Match REER VIA 7%" className="w-full border rounded-lg p-3" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (optionnel)</label>
            <input type="text" name="description" value={form.description} onChange={handleChange} className="w-full border rounded-lg p-3" />
          </div>
          <button type="submit" className="bg-green-600 text-white rounded-lg p-4 text-lg font-semibold">
            {status === 'saving' ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {status === 'success' && <p className="text-green-600 text-center">✅ Revenu enregistré</p>}
          {status === 'error' && <p className="text-red-600 text-center">❌ Erreur — voir console</p>}
        </form>
      )}

      {/* Revenu étalé */}
      {activeTab === 'etale' && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date de réception</label>
            <input type="date" name="date" value={etaléForm.date} onChange={handleEtaléChange}
              className="w-full border rounded-lg p-3" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Montant total reçu ($)</label>
            <input type="number" name="montant_total" value={etaléForm.montant_total} onChange={handleEtaléChange}
              placeholder="0.00" step="0.01" min="0" className="w-full border rounded-lg p-3" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Source</label>
            <input type="text" name="source" value={etaléForm.source} onChange={handleEtaléChange}
              placeholder="Ex: Indemnité de départ VIA" className="w-full border rounded-lg p-3" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Nb de périodes</label>
              <input type="number" name="nb_periodes" value={etaléForm.nb_periodes} onChange={handleEtaléChange}
                placeholder="Ex: 26" min="1" className="w-full border rounded-lg p-3" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Fréquence</label>
              <select name="frequence" value={etaléForm.frequence} onChange={handleEtaléChange}
                className="w-full border rounded-lg p-3">
                <option value="hebdomadaire">Hebdomadaire</option>
                <option value="bihebdomadaire">Aux 2 semaines</option>
                <option value="mensuel">Mensuel</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (optionnel)</label>
            <input type="text" name="description" value={etaléForm.description} onChange={handleEtaléChange}
              className="w-full border rounded-lg p-3" />
          </div>

          {/* Aperçu */}
          {etaléPreview && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col gap-2">
              <p className="font-semibold text-yellow-800">Aperçu — {etaléPreview.dates.length} entrées à créer</p>
              <div className="text-sm flex flex-col gap-1">
                <div className="flex justify-between"><span>Montant par période</span><span className="font-bold">{etaléPreview.montantParPeriode} $</span></div>
                <div className="flex justify-between"><span>🏦 Retraite ({split.retirement}%)</span><span>{etaléPreview.retirement} $</span></div>
                <div className="flex justify-between"><span>💰 Épargne ({split.savings}%)</span><span>{etaléPreview.savings} $</span></div>
                <div className="flex justify-between"><span>🛒 Dépenses ({split.spending}%)</span><span>{etaléPreview.spending} $</span></div>
              </div>
              <div className="border-t pt-2 max-h-40 overflow-y-auto">
                <p className="text-xs text-gray-500 mb-1">Dates générées :</p>
                {etaléPreview.dates.map((d, i) => (
                  <div key={i} className="text-xs text-gray-600 flex justify-between">
                    <span>Période {i + 1}</span><span>{d}</span>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm mt-1">
                <input type="checkbox" checked={etaléConfirmed} onChange={e => setEtaléConfirmed(e.target.checked)} />
                Je confirme la création de {etaléPreview.dates.length} entrées de revenu
              </label>
              <button onClick={handleEtaléSubmit} disabled={!etaléConfirmed || status === 'saving'}
                className={`w-full py-3 rounded-xl font-semibold text-white ${etaléConfirmed ? 'bg-green-600' : 'bg-gray-300'}`}>
                {status === 'saving' ? 'Création en cours...' : 'Créer toutes les entrées'}
              </button>
            </div>
          )}
          {status === 'success' && <p className="text-green-600 text-center">✅ {etaléForm.nb_periodes || ''} entrées créées</p>}
          {status === 'error' && <p className="text-red-600 text-center">❌ Erreur — voir console</p>}
        </div>
      )}
    </div>
  )
}