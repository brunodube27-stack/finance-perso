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
    <div className="max-w-md mx-auto p-4 pb-32">
      <h1 className="text-2xl font-bold mb-4">Comptes d'épargne</h1>

      {/* Sélecteur mois/année */}
      <div className="flex gap-2 mb-6">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="border rounded-lg p-2 flex-1">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>
              {new Date(2000, m - 1).toLocaleString('fr-CA', { month: 'long' })}
            </option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border rounded-lg p-2">
          {[2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Épargne */}
      <AccountSection
        title="💰 Épargne (35%)"
        accounts={savingsAccounts}
        entries={entries}
        onChange={handleChange}
      />

      {/* Retraite */}
      <AccountSection
        title="🏦 Retraite (10%)"
        accounts={retirementAccounts}
        entries={entries}
        onChange={handleChange}
      />

      {/* Bouton save */}
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

function AccountSection({ title, accounts, entries, onChange }) {
  const total = accounts.reduce((sum, a) => {
    return sum + (parseFloat(entries[a.id]?.balance_accounting) || 0)
  }, 0)

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
            <p className="font-medium text-sm mb-2">{a.name}</p>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Dépôt ce mois ($)</label>
                <input type="number" step="0.01"
                  value={entries[a.id]?.amount_deposited || ''}
                  onChange={e => onChange(a.id, 'amount_deposited', e.target.value)}
                  placeholder="0.00"
                  className="w-full border rounded p-2 text-sm text-right" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Solde comptable ($)</label>
                <input type="number" step="0.01"
                  value={entries[a.id]?.balance_accounting || ''}
                  onChange={e => onChange(a.id, 'balance_accounting', e.target.value)}
                  placeholder="0.00"
                  className="w-full border rounded p-2 text-sm text-right" />
              </div>
            </div>
            <input type="text"
              value={entries[a.id]?.note || ''}
              onChange={e => onChange(a.id, 'note', e.target.value)}
              placeholder="Note (optionnel)"
              className="w-full border rounded p-2 text-xs" />
          </div>
        ))}
      </div>
    </div>
  )
}