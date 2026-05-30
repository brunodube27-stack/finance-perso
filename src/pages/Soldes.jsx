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
    async function fetchData() {
      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('block')
        .order('name')

      setAccounts(accs || [])

      const { data: existing } = await supabase
        .from('account_balances')
        .select('*')
        .eq('year', year)
        .eq('month', month)

      const map = {}
      existing?.forEach(e => {
        map[e.account_id] = { balance: e.balance ?? '', note: e.note || '' }
      })

      if (accs) {
        const prevMonth = month === 1 ? 12 : month - 1
        const prevYear = month === 1 ? year - 1 : year
        const { data: prev } = await supabase
          .from('account_balances')
          .select('*')
          .eq('year', prevYear)
          .eq('month', prevMonth)

        const prevMap = {}
        prev?.forEach(e => { prevMap[e.account_id] = e.balance })

        accs.forEach(a => {
          if (!map[a.id]) {
            map[a.id] = { balance: prevMap[a.id] ?? '', note: '' }
          }
        })
      }

      setBalances(map)
    }
    fetchData()
  }, [year, month])

  useEffect(() => {
    if (!showHistory) return
    async function fetchHistory() {
      const { data } = await supabase
        .from('account_balances')
        .select('year, month, balance')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(120)

      if (!data) return

      const byPeriod = {}
      data.forEach(r => {
        const key = `${r.year}-${String(r.month).padStart(2, '0')}`
        byPeriod[key] = (byPeriod[key] || 0) + parseFloat(r.balance || 0)
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

    const upserts = Object.entries(balances)
      .filter(([_, e]) => e.balance !== '' && e.balance !== null && e.balance !== undefined)
      .map(([account_id, e]) => ({
        account_id,
        year,
        month,
        balance: parseFloat(e.balance) || 0,
        note: e.note || null,
      }))

    const { error } = await supabase
      .from('account_balances')
      .upsert(upserts, { onConflict: 'account_id,year,month' })

    setSaving(false)
    if (error) {
      setStatus('error')
      console.error(error)
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
    <div className="max-w-md mx-auto p-4 pb-32">
      <h1 className="text-2xl font-bold mb-4">Soldes des comptes</h1>

      <div className="flex gap-2 mb-4">
        <select value={month} onChange={e => { setMonth(Number(e.target.value)); setStatus(null) }}
          className="border rounded-lg p-2 flex-1">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
          ))}
        </select>
        <select value={year} onChange={e => { setYear(Number(e.target.value)); setStatus(null) }}
          className="border rounded-lg p-2">
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '20px' }}>
        <SummaryCard label="Actifs" amount={totalAssets} color="#15803d" bg="#f0fdf4" />
        <SummaryCard label="Dettes" amount={totalDebts} color="#b91c1c" bg="#fef2f2" />
        <SummaryCard label="Net" amount={netTotal} color={netTotal >= 0 ? '#1d4ed8' : '#b91c1c'} bg={netTotal >= 0 ? '#eff6ff' : '#fef2f2'} />
      </div>

      <AccountSection
        title="💳 Dépenses"
        accounts={spendingAccounts}
        balances={balances}
        onChange={handleChange}
      />
      <AccountSection
        title="💰 Épargne"
        accounts={savingsAccounts}
        balances={balances}
        onChange={handleChange}
      />
      <AccountSection
        title="🏦 Retraite"
        accounts={retirementAccounts}
        balances={balances}
        onChange={handleChange}
      />

      <button
        onClick={() => setShowHistory(v => !v)}
        className="w-full text-sm text-gray-500 border border-dashed rounded-lg p-3 mb-4 text-left"
      >
        {showHistory ? '▲ Masquer l\'historique' : '▼ Afficher l\'historique (12 mois)'}
      </button>

      {showHistory && (
        <div className="border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Période</th>
                <th className="text-right p-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map(([key, total]) => {
                const [y, m] = key.split('-')
                const label = `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
                const isCurrent = parseInt(y) === year && parseInt(m) === month
                return (
                  <tr key={key} className={isCurrent ? 'bg-blue-50' : 'border-t'}>
                    <td className="p-3 text-gray-700">{label}{isCurrent ? ' ●' : ''}</td>
                    <td className="p-3 text-right font-medium text-gray-800">
                      {total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                    </td>
                  </tr>
                )
              })}
              {history.length === 0 && (
                <tr><td colSpan={2} className="p-3 text-center text-gray-400">Aucun historique</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t">
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 text-white rounded-lg p-4 font-semibold">
          {saving ? 'Enregistrement...' : 'Sauvegarder'}
        </button>
        {status === 'success' && <p className="text-green-600 text-center mt-2">✅ Sauvegardé</p>}
        {status === 'error' && <p className="text-red-600 text-center mt-2">❌ Erreur — voir console</p>}
      </div>
    </div>
  )
}

function SummaryCard({ label, amount, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
      <p style={{ fontSize: '11px', color, marginBottom: '2px', fontWeight: '500' }}>{label}</p>
      <p style={{ fontSize: '13px', fontWeight: 'bold', color }}>
        {amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
      </p>
    </div>
  )
}

function AccountSection({ title, accounts, balances, onChange }) {
  if (accounts.length === 0) return null

  const total = accounts.reduce((s, a) => s + (parseFloat(balances[a.id]?.balance) || 0), 0)

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold text-gray-700">{title}</h2>
        <span className="text-sm text-gray-500">
          {total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {accounts.map(a => (
          <div key={a.id} className="border rounded-lg p-3">
            <p className="font-medium text-sm mb-2">{a.name}
              {a.type && <span className="ml-2 text-xs text-gray-400 font-normal">{a.type}</span>}
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Solde ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={balances[a.id]?.balance ?? ''}
                  onChange={e => onChange(a.id, 'balance', e.target.value)}
                  placeholder="0.00"
                  className="w-full border rounded p-2 text-sm text-right"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Note (optionnel)</label>
                <input
                  type="text"
                  value={balances[a.id]?.note || ''}
                  onChange={e => onChange(a.id, 'note', e.target.value)}
                  placeholder="Note..."
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
