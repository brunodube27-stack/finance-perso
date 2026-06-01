import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const METALS = [
  { key: 'or', label: 'Or', emoji: '🥇' },
  { key: 'argent', label: 'Argent', emoji: '🥈' },
]

export default function MetauxSection({ year, month }) {
  const [transactions, setTransactions] = useState([])
  const [coursMap, setCoursMap] = useState({
    or: { prix_once: '', rowId: null },
    argent: { prix_once: '', rowId: null },
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    metal: 'or',
    quantite: '1',
    date: new Date().toISOString().split('T')[0],
    prix_once: '',
  })
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [year, month])

  async function fetchAll() {
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(year, month, 0).getDate()
    const dateEnd = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
    const dateStart = `${year}-${mm}-01`

    const { data: { user } } = await supabase.auth.getUser()

    const [{ data: txs }, { data: coursData }] = await Promise.all([
      supabase
        .from('metal_transactions')
        .select('*')
        .eq('user_id', user.id)
        .lte('date', dateEnd)
        .order('date', { ascending: false }),
      supabase
        .from('metal_cours')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', dateStart)
        .lte('date', dateEnd)
        .order('date', { ascending: false }),
    ])

    setTransactions(txs || [])

    const newCours = {
      or: { prix_once: '', rowId: null },
      argent: { prix_once: '', rowId: null },
    }
    coursData?.forEach(c => {
      if (['or', 'argent'].includes(c.metal) && !newCours[c.metal].rowId) {
        newCours[c.metal] = { prix_once: c.prix_once ?? '', rowId: c.id }
      }
    })
    setCoursMap(newCours)
  }

  async function handleAddTransaction(e) {
    e.preventDefault()
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('metal_transactions').insert({
      user_id: user.id,
      metal: form.metal,
      type: 'achat',
      quantite: parseFloat(form.quantite) || 0,
      date: form.date,
      prix_once: parseFloat(form.prix_once) || 0,
    })
    setAdding(false)
    if (error) {
      console.error('insert metal_transactions error', error)
    } else {
      setShowForm(false)
      setForm({ metal: 'or', quantite: '1', date: new Date().toISOString().split('T')[0], prix_once: '' })
      fetchAll()
    }
  }

  async function handleSaveCours() {
    setSaving(true)
    setSaveStatus(null)
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(year, month, 0).getDate()
    const dateKey = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
    const { data: { user } } = await supabase.auth.getUser()

    let lastError = null
    for (const [metal, entry] of Object.entries(coursMap)) {
      if (entry.prix_once === '' || entry.prix_once === null) continue
      const val = parseFloat(entry.prix_once) || 0

      if (entry.rowId) {
        const { error } = await supabase
          .from('metal_cours')
          .update({ prix_once: val })
          .eq('id', entry.rowId)
        if (error) { lastError = error; console.error('update metal_cours error', error) }
      } else {
        const { data, error } = await supabase
          .from('metal_cours')
          .insert({ user_id: user.id, metal, date: dateKey, prix_once: val })
          .select('id')
          .single()
        if (error) { lastError = error; console.error('insert metal_cours error', error) }
        else if (data) setCoursMap(prev => ({ ...prev, [metal]: { ...prev[metal], rowId: data.id } }))
      }
    }
    setSaving(false)
    setSaveStatus(lastError ? 'error' : 'success')
  }

  const metalTotals = {}
  for (const { key } of METALS) {
    const oz = transactions
      .filter(t => t.metal === key)
      .reduce((s, t) => s + (t.type === 'achat' ? parseFloat(t.quantite || 0) : -parseFloat(t.quantite || 0)), 0)
    const coursVal = parseFloat(coursMap[key]?.prix_once) || 0
    metalTotals[key] = { oz, value: oz * coursVal }
  }

  const totalValue = Object.values(metalTotals).reduce((s, t) => s + t.value, 0)
  const cls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-amber-400"

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-semibold text-slate-600">🏅 Métaux précieux</h2>
        {totalValue > 0 && (
          <span className="text-xs text-slate-400">
            {totalValue.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
          </span>
        )}
      </div>

      {METALS.map(({ key, label, emoji }) => {
        const { oz, value } = metalTotals[key]
        const mTxs = transactions.filter(t => t.metal === key)
        return (
          <div key={key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span>{emoji}</span>
                <span className="font-semibold text-sm text-slate-800">{label}</span>
                {oz > 0 && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {oz.toFixed(4)} oz
                  </span>
                )}
              </div>
              {oz > 0 && (
                <span className="text-sm font-bold text-red-500">
                  {value.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                </span>
              )}
            </div>

            {mTxs.length > 0 && (
              <div className="mb-3 border-t border-slate-100 pt-2 space-y-1">
                {mTxs.map(t => (
                  <div key={t.id} className="flex justify-between items-center text-xs text-slate-500">
                    <div className="flex gap-2 items-center">
                      <span className={`font-semibold ${t.type === 'achat' ? 'text-red-400' : 'text-emerald-500'}`}>
                        {t.type === 'achat' ? '▼' : '▲'} {parseFloat(t.quantite).toFixed(4)} oz
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{t.date}</span>
                      <span className="text-slate-300">·</span>
                      <span>{parseFloat(t.prix_once).toFixed(2)} $/oz</span>
                    </div>
                    <span className="text-slate-400">
                      {(parseFloat(t.quantite) * parseFloat(t.prix_once)).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
                Cours fin de mois ($/oz)
              </label>
              <input
                type="number"
                step="0.01"
                value={coursMap[key]?.prix_once ?? ''}
                onChange={e => {
                  setSaveStatus(null)
                  setCoursMap(prev => ({ ...prev, [key]: { ...prev[key], prix_once: e.target.value } }))
                }}
                placeholder="0.00"
                className={`${cls} text-right`}
              />
            </div>
          </div>
        )
      })}

      <button
        onClick={() => setShowForm(v => !v)}
        className="w-full text-sm text-amber-600 border border-dashed border-amber-300 rounded-xl p-3 mb-3 text-center hover:bg-amber-50 transition-colors"
      >
        {showForm ? '✕ Annuler' : '+ Ajouter une transaction'}
      </button>

      {showForm && (
        <form onSubmit={handleAddTransaction} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Nouvelle transaction</h3>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Métal</label>
                <select value={form.metal} onChange={e => setForm(p => ({ ...p, metal: e.target.value }))} className={cls}>
                  <option value="or">🥇 Or</option>
                  <option value="argent">🥈 Argent</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Onces</label>
                <input type="number" step="0.0001" min="0.0001" required
                  value={form.quantite} onChange={e => setForm(p => ({ ...p, quantite: e.target.value }))}
                  placeholder="1.0000" className={`${cls} text-right`} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Date achat</label>
                <input type="date" required
                  value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className={cls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Prix spot ($/oz)</label>
                <input type="number" step="0.01" min="0" required
                  value={form.prix_once} onChange={e => setForm(p => ({ ...p, prix_once: e.target.value }))}
                  placeholder="0.00" className={`${cls} text-right`} />
              </div>
            </div>
            <button type="submit" disabled={adding}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2.5 font-semibold text-sm transition-colors">
              {adding ? 'Ajout...' : 'Enregistrer la transaction'}
            </button>
          </div>
        </form>
      )}

      <button onClick={handleSaveCours} disabled={saving}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2.5 font-semibold text-sm transition-colors mb-1">
        {saving ? 'Enregistrement...' : '💾 Sauvegarder les cours du mois'}
      </button>
      {saveStatus === 'success' && <p className="text-emerald-600 text-xs text-center">✓ Cours sauvegardés</p>}
      {saveStatus === 'error' && <p className="text-red-500 text-xs text-center">Erreur — voir console</p>}
    </div>
  )
}
