import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'

const today = new Date().toISOString().split('T')[0]

export default function AddTransaction() {
  const { categories, loading: loadingCat } = useCategories()
  const { accounts, loading: loadingAcc } = useAccounts()

  const [form, setForm] = useState({
    date: today,
    amount: '',
    type: 'expense',
    account_id: '',
    category_id: '',
    merchant: '',
    description: '',
    is_recurring: false,
  })
  const [status, setStatus] = useState(null)

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('saving')
    const { error } = await supabase.from('transactions').insert([{
      ...form,
      amount: parseFloat(form.amount),
    }])
    if (error) {
      setStatus('error')
      console.error(error)
    } else {
      setStatus('success')
      setForm({
        date: today,
        amount: '',
        type: 'expense',
        account_id: '',
        category_id: '',
        merchant: '',
        description: '',
        is_recurring: false,
      })
    }
  }

  if (loadingCat || loadingAcc) return <div className="p-6">Chargement...</div>

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Nouvelle transaction</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input type="date" name="date" value={form.date} onChange={handleChange}
            className="w-full border rounded-lg p-3 text-base" required />
        </div>

        {/* Montant */}
        <div>
          <label className="block text-sm font-medium mb-1">Montant ($)</label>
          <input type="number" name="amount" value={form.amount} onChange={handleChange}
            placeholder="0.00" step="0.01" min="0"
            className="w-full border rounded-lg p-3 text-base" required />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select name="type" value={form.type} onChange={handleChange}
            className="w-full border rounded-lg p-3 text-base">
            <option value="expense">Dépense</option>
            <option value="transfer">Transfert</option>
          </select>
        </div>

        {/* Compte */}
        <div>
          <label className="block text-sm font-medium mb-1">Compte</label>
          <select name="account_id" value={form.account_id} onChange={handleChange}
            className="w-full border rounded-lg p-3 text-base" required>
            <option value="">Sélectionner un compte</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Catégorie */}
        <div>
          <label className="block text-sm font-medium mb-1">Catégorie</label>
          <select name="category_id" value={form.category_id} onChange={handleChange}
            className="w-full border rounded-lg p-3 text-base" required>
            <option value="">Sélectionner une catégorie</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>

        {/* Marchand */}
        <div>
          <label className="block text-sm font-medium mb-1">Marchand (optionnel)</label>
          <input type="text" name="merchant" value={form.merchant} onChange={handleChange}
            placeholder="Ex: IGA, Costco, Netflix"
            className="w-full border rounded-lg p-3 text-base" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description (optionnel)</label>
          <input type="text" name="description" value={form.description} onChange={handleChange}
            placeholder="Note additionnelle"
            className="w-full border rounded-lg p-3 text-base" />
        </div>

        {/* Récurrent */}
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_recurring" checked={form.is_recurring} onChange={handleChange}
            className="w-5 h-5" />
          <label className="text-sm font-medium">Dépense récurrente</label>
        </div>

        {/* Submit */}
        <button type="submit"
          className="bg-blue-600 text-white rounded-lg p-4 text-lg font-semibold mt-2">
          {status === 'saving' ? 'Enregistrement...' : 'Enregistrer'}
        </button>

        {status === 'success' && <p className="text-green-600 text-center">✅ Transaction enregistrée</p>}
        {status === 'error' && <p className="text-red-600 text-center">❌ Erreur — voir console</p>}

      </form>
    </div>
  )
}