import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i).toLocaleString('fr-CA', { month: 'long' })
)

export default function Soldes() {
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [accounts, setAccounts] = useState([])
  const [balances, setBalances] = useState({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      const mm = String(month).padStart(2, '0')
      const dateKey = `${year}-${mm}-01`

      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('block')
        .order('name')

      if (cancelled) return

      setAccounts(accs || [])

      const { data: existing } = await supabase
        .from('account_balances')
        .select('*')
        .eq('date', dateKey)

      if (cancelled) return

      const map = {}
      existing?.forEach(e => {
        map[e.account_id] = { balance: e.balance ?? '', rowId: e.id }
      })

      if (accs) {
        const prevMonth = month === 1 ? 12 : month - 1
        const prevYear = month === 1 ? year - 1 : year
        const prevMm = String(prevMonth).padStart(2, '0')
        const prevDateKey = `${prevYear}-${prevMm}-01`
        const { data: prev } = await supabase
          .from('account_balances')
          .select('*')
          .eq('date', prevDateKey)

        if (cancelled) return

        const prevMap = {}
        prev?.forEach(e => { prevMap[e.account_id] = e.balance })

        accs.forEach(a => {
          if (!map[a.id]) {
            map[a.id] = { balance: prevMap[a.id] ?? '', rowId: null }
          }
        })
      }

      setBalances(map)
    }

    fetchData()
    return () => { cancelled = true }
  }, [year, month])

  useEffect(() => {
    if (!showHistory) return
    async function fetchHistory() {
      const { data } = await supabase
        .from('account_balances')
        .select('date, balance')
        .order('date', { ascending: false })
        .limit(240)

      if (!data) return

      const byPeriod = {}
      data.forEach(r => {
        const key = r.date?.slice(0, 7)
        if (key) byPeriod[key] = (byPeriod[key] || 0) + parseFloat(r.balance || 0)
      })

      const sorted = Object.entries(byPeriod)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12)

      setHistory(sorted)
    }
    fetchHistory()
  }, [showHistory])

  function handleChange(accountId, field, value) {
    setStatus(null)
    setBalances(prev => ({ ...prev, [accountId]: { ...prev[accountId], [field]: value } }))
  }

  async function handleSave() {
    setSaving(true)
    setStatus(null)

    const entries = Object.entries(balances)
      .filter(([_, e]) => e.balance !== '' && e.balance !== null && e.balance !== undefined)

    let lastError = null
    const newIds = {}

    const mm = String(month).padStart(2, '0')
    const dateKey = `${year}-${mm}-01`
    const { data: { user } } = await supabase.auth.getUser()

    for (const [account_id, e] of entries) {
      const balanceVal = parseFloat(e.balance) || 0

      if (e.rowId) {
        const { error } = await supabase
          .from('account_balances')
          .update({ balance: balanceVal })
          .eq('id', e.rowId)
        if (error) { lastError = error; console.error('update error', error) }
      } else {
        const { data, error } = await supabase
          .from('account_balances')
          .insert({ account_id, date: dateKey, balance: balanceVal, user_id: user?.id })
          .select('id')
          .single()
        if (error) { lastError = error; console.error('insert error', error) }
        else if (data) newIds[account_id] = data.id
      }
    }

    if (Object.keys(newIds).length > 0) {
      setBalances(prev => {
        const next = { ...prev }
        for (const [aid, rid] of Object.entries(newIds)) {
          next[aid] = { ...next[aid], rowId: rid }
        }
        return next
      })
    }

    setSaving(false)
    if (lastError) {
      setStatus('error')
    } else {
      setStatus('success')
      if (showHistory) setShowHistory(false)
    }
  }

  const spendingAccounts = accounts.filter(a => a.block === 'spending')
  const savingsAccounts = accounts.filter(a => a.block === 'savings')
  const retirementAccounts = accounts.filter(a => a.block === 'retirement')

  const totalAssets = accounts
    .filter(a => a.type !== 'credit' && a.type !== 'loan')
    .reduce((s, a) => s + (parseFloat(balances[a.id]?.balance) || 0), 0)
  const totalDebts = accounts
    .filter(a => a.type === 'credit' || a.type === 'loan')
    .reduce((s, a) => s + (parseFloat(balances[a.id]?.balance) || 0), 0)
  const netTotal = totalAssets - totalDebts

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-36">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Soldes des comptes</h1>

      <div className="flex gap-2 mb-4">
        <select value={month} onChange={e => { setMonth(Number(e.target.value)); setStatus(null) }}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
          ))}
        </select>
        <select value={year} onChange={e => { setYear(Number(e.target.value)); setStatus(null) }}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <SummaryCard label="Actifs" amount={totalAssets} color="#15803d" bg="#f0fdf4" />
        <SummaryCard label="Dettes" amount={totalDebts} color="#b91c1c" bg="#fef2f2" />
        <SummaryCard label="Net" amount={netTotal}
          color={netTotal >= 0 ? '#1d4ed8' : '#b91c1c'}
          bg={netTotal >= 0 ? '#eff6ff' : '#fef2f2'} />
      </div>

      <BalanceSection title="💳 Dépenses" accounts={spendingAccounts} balances={balances} onChange={handleChange} />
      <BalanceSection title="💰 Épargne" accounts={savingsAccounts} balances={balances} onChange={handleChange} />
      <BalanceSection title="🏦 Retraite" accounts={retirementAccounts} balances={balances} onChange={handleChange} />

      <button
        onClick={() => setShowHistory(v => !v)}
        className="w-full text-sm text-slate-400 border border-dashed border-slate-300 rounded-xl p-3 mb-4 text-left hover:bg-slate-50 transition-colors">
        {showHistory ? '▲ Masquer l\'historique' : '▼ Afficher l\'historique (12 mois)'}
      </button>

      {showHistory && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Période</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map(([key, total]) => {
                const [y, m] = key.split('-')
                const label = `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
                const isCurrent = parseInt(y) === year && parseInt(m) === month
                return (
                  <tr key={key} className={`border-t border-slate-50 ${isCurrent ? 'bg-indigo-50' : ''}`}>
                    <td className="px-4 py-2.5 text-sm text-slate-700">
                      {label}
                      {isCurrent && <span className="ml-2 text-indigo-500 text-xs font-semibold">●</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                      {total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                    </td>
                  </tr>
                )
              })}
              {history.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-4 text-center text-slate-400 text-sm">Aucun historique</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="fixed bottom-[72px] left-0 right-0 px-4 py-3 bg-white border-t border-slate-100">
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors">
          {saving ? 'Enregistrement...' : 'Sauvegarder'}
        </button>
        {status === 'success' && <p className="text-emerald-600 text-center text-sm mt-2">✓ Sauvegardé</p>}
        {status === 'error' && <p className="text-red-500 text-center text-sm mt-2">Erreur — voir console</p>}
      </div>
    </div>
  )
}

function SummaryCard({ label, amount, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: '16px', padding: '10px', textAlign: 'center', border: `1px solid ${color}22` }}>
      <p style={{ fontSize: '10px', color, marginBottom: '3px', fontWeight: '600', letterSpacing: '0.03em' }}>{label}</p>
      <p style={{ fontSize: '13px', fontWeight: '700', color, lineHeight: 1.2 }}>
        {amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
      </p>
    </div>
  )
}

function BalanceSection({ title, accounts, balances, onChange }) {
  if (accounts.length === 0) return null

  const total = accounts.reduce((s, a) => s + (parseFloat(balances[a.id]?.balance) || 0), 0)

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-semibold text-slate-600">{title}</h2>
        <span className="text-xs text-slate-400">{total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
      </div>
      <div className="flex flex-col gap-3">
        {accounts.map(a => (
          <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="font-semibold text-sm text-slate-800">{a.name}</p>
              {a.type && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{a.type}</span>}
            </div>
            <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Solde ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={balances[a.id]?.balance ?? ''}
                  onChange={e => onChange(a.id, 'balance', e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400 text-right"
                />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
