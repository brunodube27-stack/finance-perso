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

  if (loading) return (
    <div className="flex items-center justify-center pt-20">
      <div className="text-slate-400 text-sm">Chargement...</div>
    </div>
  )

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400"

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-36">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-slate-800">Budget</h1>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400">
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 mb-4 flex justify-between items-center">
        <span className="text-sm text-slate-500">Total annuel</span>
        <span className="font-bold text-slate-800">{totalAnnual.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">🎯 Revenu net annuel estimé</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Revenu minimum (dépenses fixes)</label>
            <div className="flex items-center gap-2">
              <input type="number" value={incomeTarget.amount_min}
                onChange={e => setIncomeTarget(p => ({ ...p, amount_min: e.target.value }))}
                placeholder="0" className={`${inputCls} text-right`} />
              <span className="text-xs text-slate-400 whitespace-nowrap">$/an</span>
            </div>
            {incomeTarget.amount_min && (
              <p className="text-xs text-slate-400 mt-1">→ {(parseFloat(incomeTarget.amount_min) / 12).toFixed(0)} $/mois</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Revenu cible (10/35/55)</label>
            <div className="flex items-center gap-2">
              <input type="number" value={incomeTarget.amount_target}
                onChange={e => setIncomeTarget(p => ({ ...p, amount_target: e.target.value }))}
                placeholder="0" className={`${inputCls} text-right`} />
              <span className="text-xs text-slate-400 whitespace-nowrap">$/an</span>
            </div>
            {incomeTarget.amount_target && (
              <p className="text-xs text-slate-400 mt-1">→ {(parseFloat(incomeTarget.amount_target) / 12).toFixed(0)} $/mois</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Note</label>
            <input type="text" value={incomeTarget.note}
              onChange={e => setIncomeTarget(p => ({ ...p, note: e.target.value }))}
              placeholder="Ex: Basé sur 3 contrats/mois" className={inputCls} />
          </div>
          <button onClick={handleSaveTarget} disabled={savingTarget}
            className="w-full bg-slate-700 hover:bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
            {savingTarget ? 'Enregistrement...' : 'Sauvegarder revenu cible'}
          </button>
        </div>
      </div>

      <BudgetSection title="🏦 Retraite (10%)" categories={retirementCats} budgets={budgets} onChange={handleChange} />
      <BudgetSection title="💰 Épargne (35%)" categories={savingsCats} budgets={budgets} onChange={handleChange} />
      <BudgetSection title="🛒 Dépenses (55%)" categories={spendingCats} budgets={budgets} onChange={handleChange} />

      <div className="fixed bottom-[72px] left-0 right-0 px-4 py-3 bg-white border-t border-slate-100">
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors">
          {saving ? 'Enregistrement...' : 'Sauvegarder le budget'}
        </button>
        {status === 'success' && <p className="text-emerald-600 text-center text-sm mt-2">✓ Budget sauvegardé</p>}
        {status === 'error' && <p className="text-red-500 text-center text-sm mt-2">Erreur — voir console</p>}
      </div>
    </div>
  )
}

function BudgetSection({ title, categories, budgets, onChange }) {
  const total = categories.reduce((sum, c) => sum + parseFloat(budgets[c.id] || 0), 0)
  if (categories.length === 0) return null

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-semibold text-slate-600">{title}</h2>
        <span className="text-xs text-slate-400">{total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}/an</span>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {categories.map((c, idx) => (
          <div key={c.id} className={`flex items-center gap-3 px-4 py-3 ${idx < categories.length - 1 ? 'border-b border-slate-50' : ''}`}>
            <span className="text-xs font-bold text-slate-400 w-8 shrink-0">{c.code}</span>
            <span className="text-sm text-slate-700 flex-1">{c.name}</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={budgets[c.id] || ''}
                onChange={e => onChange(c.id, e.target.value)}
                placeholder="0"
                className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-right text-sm bg-white focus:outline-none focus:border-indigo-400"
              />
              <span className="text-xs text-slate-400">$/an</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}