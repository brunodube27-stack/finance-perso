import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const today = new Date().toISOString().split('T')[0]

export default function AddIncome() {
  const [split, setSplit] = useState({ retirement: 10, savings: 35, spending: 55 })
  const [form, setForm] = useState({
    date: today,
    amount: '',
    type: 'variable',
    source: '',
    description: '',
    employer_contribution: '',
    employer_contribution_note: '',
  })
  const [status, setStatus] = useState(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    async function fetchSplit() {
      const { data } = await supabase
        .from('split_config')
        .select('*')
        .lte('valid_from', today)
        .order('valid_from', { ascending: false })
        .limit(1)
      if (data && data.length > 0) {
        setSplit({
          retirement: data[0].pct_retirement,
          savings: data[0].pct_savings,
          spending: data[0].pct_spending,
        })
      }
    }
    fetchSplit()
  }, [])

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
    } else {
      setPreview(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('saving')
    const amt = parseFloat(form.amount)
    const payload = {
      date: form.date,
      amount: amt,
      type: form.type,
      source: form.source,
      description: form.description,
      split_retirement: (amt * split.retirement / 100),
      split_savings: (amt * split.savings / 100),
      split_spending: (amt * split.spending / 100),
      employer_contribution: form.employer_contribution ? parseFloat(form.employer_contribution) : 0,
      employer_contribution_note: form.employer_contribution_note || null,
    }
    const { error } = await supabase.from('income').insert([payload])
    if (error) {
      setStatus('error')
      console.error(error)
    } else {
      setStatus('success')
      setForm({
        date: today,
        amount: '',
        type: 'variable',
        source: '',
        description: '',
        employer_contribution: '',
        employer_contribution_note: '',
      })
      setPreview(null)
    }
  }
  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Nouveau revenu</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input type="date" name="date" value={form.date} onChange={handleChange}
            className="w-full border rounded-lg p-3 text-base" required />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Montant net reçu ($)</label>
          <input type="number" name="amount" value={form.amount} onChange={handleChange}
            placeholder="0.00" step="0.01" min="0"
            className="w-full border rounded-lg p-3 text-base" required />
        </div>

        {preview && (
          <div className="bg-blue-50 rounded-lg p-4 flex flex-col gap-1">
            <p className="text-sm font-semibold text-blue-800 mb-1">Répartition automatique</p>
            <div className="flex justify-between text-sm">
              <span>🏦 Retraite ({split.retirement}%)</span>
              <span className="font-medium">{preview.retirement} $</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>💰 Épargne ({split.savings}%)</span>
              <span className="font-medium">{preview.savings} $</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🛒 Dépenses ({split.spending}%)</span>
              <span className="font-medium">{preview.spending} $</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select name="type" value={form.type} onChange={handleChange}
            className="w-full border rounded-lg p-3 text-base">
            <option value="fixed">Fixe (chômage, indemnité)</option>
            <option value="variable">Variable (consultation)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Source</label>
          <input type="text" name="source" value={form.source} onChange={handleChange}
            placeholder="Ex: Chômage, Consultation XYZ"
            className="w-full border rounded-lg p-3 text-base" required />
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">Contribution employeur (optionnel)</p>
          <div className="flex flex-col gap-2">
            <input type="number" name="employer_contribution" value={form.employer_contribution}
              onChange={handleChange} placeholder="Montant ($)" step="0.01" min="0"
              className="w-full border rounded-lg p-3 text-base" />
            <input type="text" name="employer_contribution_note" value={form.employer_contribution_note}
              onChange={handleChange} placeholder="Ex: Match REER VIA 7%"
              className="w-full border rounded-lg p-3 text-base" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description (optionnel)</label>
          <input type="text" name="description" value={form.description} onChange={handleChange}
            className="w-full border rounded-lg p-3 text-base" />
        </div>

        <button type="submit"
          className="bg-green-600 text-white rounded-lg p-4 text-lg font-semibold mt-2">
          {status === 'saving' ? 'Enregistrement...' : 'Enregistrer'}
        </button>

        {status === 'success' && <p className="text-green-600 text-center">✅ Revenu enregistré</p>}
        {status === 'error' && <p className="text-red-600 text-center">❌ Erreur — voir console</p>}

      </form>
    </div>
  )
}