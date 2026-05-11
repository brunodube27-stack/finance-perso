import { useState, useEffect } from 'react'

import { supabase } from '../supabaseClient'

export default function Metaux() {
  const [transactions, setTransactions] = useState([])
  const [cours, setCours] = useState([])
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    metal: 'or',
    type: 'achat',
    quantite: '',
    prix_once: ''
  })
  const [coursForm, setCoursForm] = useState({
    date: new Date().toISOString().split('T')[0],
    metal: 'or',
    prix_once: ''
  })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('resume')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    
    const [{ data: trans }, { data: coursData }] = await Promise.all([
      supabase.from('metal_transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('metal_cours').select('*').eq('user_id', user.id).order('date', { ascending: false })
    ])
    
    setTransactions(trans || [])
    setCours(coursData || [])
  }

  function calculeResume(metal) {
    const trans = transactions.filter(t => t.metal === metal)
    const onces = trans.reduce((acc, t) => 
      t.type === 'achat' ? acc + parseFloat(t.quantite) : acc - parseFloat(t.quantite), 0)
    const coutTotal = trans
      .filter(t => t.type === 'achat')
      .reduce((acc, t) => acc + parseFloat(t.quantite) * parseFloat(t.prix_once), 0)
    const dernierCours = cours.find(c => c.metal === metal)
    const valeurReelle = dernierCours ? onces * parseFloat(dernierCours.prix_once) : null
    const rendement = valeurReelle ? valeurReelle - coutTotal : null

    return { onces, coutTotal, valeurReelle, rendement, dernierCours }
  }

  async function handleSubmitTransaction(e) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('metal_transactions').insert({
      ...form,
      user_id: user.id,
      quantite: parseFloat(form.quantite),
      prix_once: parseFloat(form.prix_once)
    })
    setForm({ date: new Date().toISOString().split('T')[0], metal: 'or', type: 'achat', quantite: '', prix_once: '' })
    setLoading(false)
    fetchData()
  }

  async function handleSubmitCours(e) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('metal_cours').insert({
      ...coursForm,
      user_id: user.id,
      prix_once: parseFloat(coursForm.prix_once)
    })
    setCoursForm({ date: new Date().toISOString().split('T')[0], metal: 'or', prix_once: '' })
    setLoading(false)
    fetchData()
  }

  const or = calculeResume('or')
  const argent = calculeResume('argent')

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Métaux Précieux</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['resume', 'transaction', 'cours', 'historique'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-full text-sm capitalize ${activeTab === tab ? 'bg-yellow-500 text-white' : 'bg-gray-100'}`}>
            {tab === 'resume' ? 'Résumé' : tab === 'transaction' ? 'Transaction' : tab === 'cours' ? 'Cours' : 'Historique'}
          </button>
        ))}
      </div>

      {/* Résumé */}
      {activeTab === 'resume' && (
        <div className="space-y-4">
          {[{ label: 'Or', data: or, color: 'yellow' }, { label: 'Argent', data: argent, color: 'gray' }].map(({ label, data, color }) => (
            <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4`}>
              <h2 className="font-bold text-lg mb-2">{label}</h2>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Inventaire</span><span className="font-medium">{data.onces.toFixed(4)} oz</span></div>
                <div className="flex justify-between"><span>Coût total</span><span className="font-medium">{data.coutTotal.toFixed(2)} $</span></div>
                {data.valeurReelle !== null && <>
                  <div className="flex justify-between"><span>Valeur réelle</span><span className="font-medium">{data.valeurReelle.toFixed(2)} $</span></div>
                  <div className="flex justify-between"><span>Rendement</span>
                    <span className={`font-bold ${data.rendement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {data.rendement >= 0 ? '+' : ''}{data.rendement.toFixed(2)} $
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Cours au {data.dernierCours.date} : {parseFloat(data.dernierCours.prix_once).toFixed(2)} $/oz</div>
                </>}
                {data.valeurReelle === null && <div className="text-xs text-gray-400">Aucun cours entré</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nouvelle transaction */}
      {activeTab === 'transaction' && (
        <form onSubmit={handleSubmitTransaction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
              className="w-full border rounded-lg p-2" required />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Métal</label>
              <select value={form.metal} onChange={e => setForm({...form, metal: e.target.value})}
                className="w-full border rounded-lg p-2">
                <option value="or">Or</option>
                <option value="argent">Argent</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                className="w-full border rounded-lg p-2">
                <option value="achat">Achat</option>
                <option value="vente">Vente</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Quantité (oz)</label>
              <input type="number" step="0.0001" value={form.quantite} onChange={e => setForm({...form, quantite: e.target.value})}
                className="w-full border rounded-lg p-2" placeholder="1.0000" required />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Prix/oz ($CAD)</label>
              <input type="number" step="0.01" value={form.prix_once} onChange={e => setForm({...form, prix_once: e.target.value})}
                className="w-full border rounded-lg p-2" placeholder="0.00" required />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-yellow-500 text-white py-3 rounded-xl font-medium">
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      )}

      {/* Cours du marché */}
      {activeTab === 'cours' && (
        <form onSubmit={handleSubmitCours} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" value={coursForm.date} onChange={e => setCoursForm({...coursForm, date: e.target.value})}
              className="w-full border rounded-lg p-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Métal</label>
            <select value={coursForm.metal} onChange={e => setCoursForm({...coursForm, metal: e.target.value})}
              className="w-full border rounded-lg p-2">
              <option value="or">Or</option>
              <option value="argent">Argent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prix spot ($CAD/oz)</label>
            <input type="number" step="0.01" value={coursForm.prix_once} onChange={e => setCoursForm({...coursForm, prix_once: e.target.value})}
              className="w-full border rounded-lg p-2" placeholder="0.00" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-yellow-500 text-white py-3 rounded-xl font-medium">
            {loading ? 'Enregistrement...' : 'Mettre à jour le cours'}
          </button>
        </form>
      )}

      {/* Historique */}
      {activeTab === 'historique' && (
        <div className="space-y-2">
          {transactions.length === 0 && <p className="text-gray-400 text-center py-8">Aucune transaction</p>}
          {transactions.map(t => (
            <div key={t.id} className="bg-white border rounded-xl p-3 flex justify-between items-center">
              <div>
                <div className="font-medium capitalize">{t.metal} — {t.type}</div>
                <div className="text-xs text-gray-400">{t.date} · {parseFloat(t.quantite).toFixed(4)} oz @ {parseFloat(t.prix_once).toFixed(2)} $/oz</div>
              </div>
              <div className={`font-bold ${t.type === 'achat' ? 'text-red-500' : 'text-green-500'}`}>
                {t.type === 'achat' ? '-' : '+'}{(parseFloat(t.quantite) * parseFloat(t.prix_once)).toFixed(2)} $
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}