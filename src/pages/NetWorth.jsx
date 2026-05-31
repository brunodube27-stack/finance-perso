import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const today = new Date().toISOString().split('T')[0]

export default function NetWorth() {
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState({})
  const [accounting, setAccounting] = useState({})
  const [form, setForm] = useState({ account_id: '', balance_real: '', date: today, note: '' })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('block')

    setAccounts(accs || [])

    // Dernier snapshot par compte
    const { data: snaps } = await supabase
      .from('net_worth_snapshot')
      .select('*')
      .lte('date', today)
      .order('date', { ascending: false })

    const snapMap = {}
    snaps?.forEach(s => {
      if (!snapMap[s.account_id]) snapMap[s.account_id] = s
    })
    setSnapshots(snapMap)

    // Dernier solde comptable par compte
    const now = new Date()
    const { data: tracking } = await supabase
      .from('savings_tracking')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    const accMap = {}
    tracking?.forEach(t => {
      if (!accMap[t.account_id]) accMap[t.account_id] = t.balance_accounting
    })
    setAccounting(accMap)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleSaveSnapshot(e) {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    const { error } = await supabase.from('net_worth_snapshot').insert([{
      account_id: form.account_id,
      date: form.date,
      balance_real: parseFloat(form.balance_real),
      note: form.note || null,
      source: 'manuel',
    }])
    if (error) {
      setStatus('error')
      console.error(error)
    } else {
      setStatus('success')
      setForm({ account_id: '', balance_real: '', date: today, note: '' })
      await fetchData()
    }
    setSaving(false)
  }

  const spendingAccounts = accounts.filter(a => a.block === 'spending')
  const savingsAccounts = accounts.filter(a => a.block === 'savings')
  const retirementAccounts = accounts.filter(a => a.block === 'retirement')

  const totalAccounting = Object.values(accounting).reduce((s, v) => s + parseFloat(v || 0), 0)
  const totalReal = Object.values(snapshots).reduce((s, v) => s + parseFloat(v.balance_real || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center pt-20">
      <div className="text-slate-400 text-sm">Chargement...</div>
    </div>
  )

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400"
  const rendement = totalReal - totalAccounting

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Valeur nette</h1>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
          <p className="text-xs font-semibold text-emerald-600 mb-1">Comptable</p>
          <p className="font-bold text-emerald-700 text-sm">{totalAccounting.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
          <p className="text-xs font-semibold text-blue-600 mb-1">Réel</p>
          <p className="font-bold text-blue-700 text-sm">{totalReal.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className={`${rendement >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} border rounded-2xl p-3 text-center`}>
          <p className={`text-xs font-semibold mb-1 ${rendement >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>Rendement</p>
          <p className={`font-bold text-sm ${rendement >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{rendement.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
      </div>

      <NWSection title="💰 Épargne" accounts={savingsAccounts} snapshots={snapshots} accounting={accounting} />
      <NWSection title="🏦 Retraite" accounts={retirementAccounts} snapshots={snapshots} accounting={accounting} />
      <NWSection title="💳 Dépenses" accounts={spendingAccounts} snapshots={snapshots} accounting={accounting} />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mt-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">📸 Nouveau snapshot</h2>
        <form onSubmit={handleSaveSnapshot} className="flex flex-col gap-3">
          <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
            className={inputCls} required>
            <option value="">Sélectionner un compte</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className={inputCls} required />
            <input type="number" step="0.01" placeholder="Valeur réelle ($)"
              value={form.balance_real} onChange={e => setForm(p => ({ ...p, balance_real: e.target.value }))}
              className={`${inputCls} text-right`} required />
          </div>
          <input type="text" placeholder="Note (ex: Relevé Q1 Questrade)"
            value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
            className={inputCls} />
          <button type="submit" disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-semibold text-sm transition-colors">
            {saving ? 'Enregistrement...' : 'Sauvegarder snapshot'}
          </button>
          {status === 'success' && <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-sm text-emerald-700 text-center">✓ Snapshot enregistré</div>}
          {status === 'error' && <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-sm text-red-600 text-center">Erreur</div>}
        </form>
      </div>
    </div>
  )
}

function NWSection({ title, accounts, snapshots, accounting }) {
  if (accounts.length === 0) return null
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-2">{title}</h2>
      <div className="flex flex-col gap-2">
        {accounts.map(a => {
          const snap = snapshots[a.id]
          const acc = parseFloat(accounting[a.id] || 0)
          const real = parseFloat(snap?.balance_real || 0)
          const diff = real - acc
          return (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm text-slate-800">{a.name}</span>
                {snap && <span className="text-xs text-slate-400">{snap.date}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Comptable</p>
                  <p className="text-sm font-semibold text-slate-700">{acc.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Réel</p>
                  <p className="text-sm font-semibold text-slate-700">{snap ? real.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' }) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Rendement</p>
                  <p className={`text-sm font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {snap ? diff.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' }) : '—'}
                  </p>
                </div>
              </div>
              {snap?.note && <p className="text-xs text-slate-400 mt-2">{snap.note}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}