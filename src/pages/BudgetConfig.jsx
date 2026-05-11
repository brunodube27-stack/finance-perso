import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useCategories } from '../hooks/useCategories'

const currentYear = new Date().getFullYear()

export default function BudgetConfig() {
  const { categories, loading } = useCategories()
  const [budgets, setBudgets] = useState({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [year, setYear] = useState(currentYear)
  const [incomeTarget, setIncomeTarget] = useState({ amount_min: '', amount_target: '', note: '' })
  const [savingTarget, setSavingTarget] = useState(false)

  useEffect(() => {
    async function fetchBudgets() {
      const { data } = await supabase
        .from('budget')
        .select('*')
        .eq('year', year)
      const map = {}
      data?.forEach(b => { map[b.category_id] = b.amount_annual })
      setBudgets(map)

      const { data: target } = await supabase
        .from('income_target')
        .select('*')
        .eq('year', year)
        .single()
      if (target) setIncomeTarget({
        amount_min: target.amount_min,
        amount_target: target.amount_target,
        note: target.note || ''
      })
      else setIncomeTarget({ amount_min: '', amount_target: '', note: '' })
    }
    fetchBudgets()
  }, [year])

  function handleChange(categoryId, value) {
    setBudgets(prev => ({ ...prev, [categoryId]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    const upserts = Object.entries(budgets)
      .filter(([_, val]) => val !== '' && val !== undefined)
      .map(([category_id, amount_annual]) => ({
        category_id,
        year,
        amount_annual: parseFloat(amount_annual),
      }))
    const { error } = await supabase
      .from('budget')
      .upsert(upserts, { onConflict: 'category_id,year' })
    setSaving(false)
    setStatus(error ? 'error' : 'success')
  }

  async function handleSaveTarget() {
    setSavingTarget(true)
    await supabase.from('income_target').upsert({
      year,
      amount_min: parseFloat(incomeTarget.amount_min) || 0,
      amount_target: parseFloat(incomeTarget.amount_target) || 0,
      note: incomeTarget.note || null,
    }, { onConflict: 'year' })
    setSavingTarget(false)
  }

  const spendingCats = categories.filter(c => c.block === 'spending')
  const savingsCats = categories.filter(c => c.block === 'savings')
  const retirementCats = categories.filter(c => c.block === 'retirement')

  const totalAnnual = Object.values(budgets)
    .filter(v => v !== '' && v !== undefined)
    .reduce((sum, v) => sum + parseFloat(v || 0), 0)

  if (loading) return <div className="p-6">Chargement...</div>

  return (
    <div className="max-w-md mx-auto p-4 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Budget</h1>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border rounded-lg p-2">
          {[2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Total */}
      <div className="bg-gray-100 rounded-lg p-3 mb-6 flex justify-between">
        <span className="text-sm text-gray-600">Total annuel</span>
        <span className="font-bold">{totalAnnual.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
      </div>

      {/* Revenu cible */}
      <div className="mb-6 border rounded-lg p-4 bg-gray-50">
        <h2 className="font-semibold text-gray-700 mb-3">🎯 Revenu net annuel estimé</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Revenu minimum (dépenses fixes seulement)</label>
            <div className="flex items-center gap-2">
              <input type="number" value={incomeTarget.amount_min}
                onChange={e => setIncomeTarget(p => ({ ...p, amount_min: e.target.value }))}
                placeholder="0" className="flex-1 border rounded-lg p-2 text-right text-sm" />
              <span className="text-xs text-gray-400">$/an</span>
            </div>
            {incomeTarget.amount_min && (
              <p className="text-xs text-gray-500 mt-1">
                → {(parseFloat(incomeTarget.amount_min) / 12).toFixed(0)} $/mois à facturer
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Revenu cible (respecter 10/35/55)</label>
            <div className="flex items-center gap-2">
              <input type="number" value={incomeTarget.amount_target}
                onChange={e => setIncomeTarget(p => ({ ...p, amount_target: e.target.value }))}
                placeholder="0" className="flex-1 border rounded-lg p-2 text-right text-sm" />
              <span className="text-xs text-gray-400">$/an</span>
            </div>
            {incomeTarget.amount_target && (
              <p className="text-xs text-gray-500 mt-1">
                → {(parseFloat(incomeTarget.amount_target) / 12).toFixed(0)} $/mois à facturer
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Note (optionnel)</label>
            <input type="text" value={incomeTarget.note}
              onChange={e => setIncomeTarget(p => ({ ...p, note: e.target.value }))}
              placeholder="Ex: Basé sur 3 contrats/mois"
              className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <button onClick={handleSaveTarget} disabled={savingTarget}
            className="bg-gray-700 text-white rounded-lg p-2 text-sm font-medium">
            {savingTarget ? 'Enregistrement...' : 'Sauvegarder revenu cible'}
          </button>
        </div>
      </div>

      {/* Retraite */}
      <Section title="🏦 Retraite (10%)" categories={retirementCats} budgets={budgets} onChange={handleChange} />

      {/* Épargne */}
      <Section title="💰 Épargne (35%)" categories={savingsCats} budgets={budgets} onChange={handleChange} />

      {/* Dépenses */}
      <Section title="🛒 Dépenses (55%)" categories={spendingCats} budgets={budgets} onChange={handleChange} />

      {/* Bouton save */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t">
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 text-white rounded-lg p-4 font-semibold">
          {saving ? 'Enregistrement...' : 'Sauvegarder le budget'}
        </button>
        {status === 'success' && <p className="text-green-600 text-center mt-2">✅ Budget sauvegardé</p>}
        {status === 'error' && <p className="text-red-600 text-center mt-2">❌ Erreur — voir console</p>}
      </div>
    </div>
  )
}

function Section({ title, categories, budgets, onChange }) {
  const total = categories.reduce((sum, c) => sum + parseFloat(budgets[c.id] || 0), 0)

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold text-gray-700">{title}</h2>
        <span className="text-sm text-gray-500">
          {total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}/an
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {categories.map(c => (
          <div key={c.id} className="flex items-center gap-2 border rounded-lg p-3">
            <span className="text-sm text-gray-600 w-8">{c.code}</span>
            <span className="text-sm flex-1">{c.name}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={budgets[c.id] || ''}
                onChange={e => onChange(c.id, e.target.value)}
                placeholder="0"
                className="w-28 border rounded p-1 text-right text-sm"
              />
              <span className="text-xs text-gray-400">$/an</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}