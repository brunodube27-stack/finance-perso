import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

export default function SavingsTracking() {
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [accounts, setAccounts] = useState([])
  const [entries, setEntries] = useState({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    async function fetchData() {
      // Comptes d'épargne et retraite seulement
      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .in('block', ['savings', 'retirement'])
        .eq('is_active', true)
        .order('name')

      setAccounts(accs || [])

      // Entrées existantes pour ce mois
      const { data: existing } = await supabase
        .from('savings_tracking')
        .select('*')
        .eq('year', year)
        .eq('month', month)

      const map = {}
      existing?.forEach(e => {
        map[e.account_id] = {
          amount_deposited: e.amount_deposited,
          balance_accounting: e.balance_accounting,
          note: e.note || '',
        }
      })

      // Pour les comptes sans entrée ce mois, suggère le solde du mois précédent
      if (accs) {
        const prevMonth = month === 1 ? 12 : month - 1
        const prevYear = month === 1 ? year - 1 : year
        const { data: prev } = await supabase
          .from('savings_tracking')
          .select('*')
          .eq('year', prevYear)
          .eq('month', prevMonth)

        const prevMap = {}
        prev?.forEach(e => { prevMap[e.account_id] = e.balance_accounting })

        accs.forEach(a => {
          if (!map[a.id]) {
            map[a.id] = {
              amount_deposited: '',
              balance_accounting: prevMap[a.id] || '',
              note: '',
            }
          }
        })
      }

      setEntries(map)
    }
    fetchData()
  }, [year, month])

  function handleChange(accountId, field, value) {
    setEntries(prev => {
      const updated = { ...prev, [accountId]: { ...prev[accountId], [field]: value } }
      // Recalcule le solde comptable si dépôt change
      if (field === 'amount_deposited') {
        const prevBalance = parseFloat(updated[accountId].balance_accounting) || 0
        const deposit = parseFloat(value) || 0
        // On ne recalcule pas auto — l'utilisateur contrôle le solde
      }
      return updated
    })
  }

  async function handleSave() {
    setSaving(true)
    setStatus(null)

    const upserts = Object.entries(entries)
      .filter(([_, e]) => e.amount_deposited !== '' || e.balance_accounting !== '')
      .map(([account_id, e]) => ({
        account_id,
        year,
        month,
        amount_deposited: parseFloat(e.amount_deposited) || 0,
        balance_accounting: parseFloat(e.balance_accounting) || 0,
        note: e.note || null,
      }))

    const { error } = await supabase
      .from('savings_tracking')
      .upsert(upserts, { onConflict: 'account_id,year,month' })

    setSaving(false)
    setStatus(error ? 'error' : 'success')
  }

  const savingsAccounts = accounts.filter(a => a.block === 'savings')
  const retirementAccounts = accounts.filter(a => a.block === 'retirement')

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-36">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Comptes d'épargne</h1>

      <div className="flex gap-2 mb-5">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('fr-CA', { month: 'long' })}</option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <SavingsSection title="💰 Épargne (35%)" accounts={savingsAccounts} entries={entries} onChange={handleChange} />
      <SavingsSection title="🏦 Retraite (10%)" accounts={retirementAccounts} entries={entries} onChange={handleChange} />

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

function SavingsSection({ title, accounts, entries, onChange }) {
  const total = accounts.reduce((sum, a) => sum + (parseFloat(entries[a.id]?.balance_accounting) || 0), 0)
  if (accounts.length === 0) return null

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-semibold text-slate-600">{title}</h2>
        <span className="text-xs text-slate-400">{total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
      </div>
      <div className="flex flex-col gap-3">
        {accounts.map(a => (
          <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="font-semibold text-sm text-slate-800 mb-3">{a.name}</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Dépôt ce mois ($)</label>
                <input type="number" step="0.01"
                  value={entries[a.id]?.amount_deposited || ''}
                  onChange={e => onChange(a.id, 'amount_deposited', e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400 text-right" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Solde comptable ($)</label>
                <input type="number" step="0.01"
                  value={entries[a.id]?.balance_accounting || ''}
                  onChange={e => onChange(a.id, 'balance_accounting', e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400 text-right" />
              </div>
            </div>
            <input type="text"
              value={entries[a.id]?.note || ''}
              onChange={e => onChange(a.id, 'note', e.target.value)}
              placeholder="Note (optionnel)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400" />
          </div>
        ))}
      </div>
    </div>
  )
}