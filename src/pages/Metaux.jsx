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

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-amber-400"
  const tabs = [['resume', 'Résumé'], ['transaction', 'Transaction'], ['cours', 'Cours'], ['historique', 'Historique']]

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Métaux Précieux</h1>

      <div className="flex gap-2 mb-4" style={{ overflowX: 'auto' }}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === key ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        {activeTab === 'resume' && (
          <div className="flex flex-col gap-4">
            {[{ label: '🥇 Or', data: or, accent: 'amber' }, { label: '🥈 Argent', data: argent, accent: 'slate' }].map(({ label, data, accent }) => (
              <div key={label} className={`${accent === 'amber' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'} border rounded-2xl p-4`}>
                <h2 className="font-bold text-slate-800 mb-3">{label}</h2>
                <div className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Inventaire</span><span className="font-semibold text-slate-800">{data.onces.toFixed(4)} oz</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Coût total</span><span className="font-semibold text-slate-800">{data.coutTotal.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span></div>
                  {data.valeurReelle !== null ? <>
                    <div className="flex justify-between"><span className="text-slate-500">Valeur réelle</span><span className="font-semibold text-slate-800">{data.valeurReelle.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-0.5">
                      <span className="text-slate-500">Rendement</span>
                      <span className={`font-bold ${data.rendement >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {data.rendement >= 0 ? '+' : ''}{data.rendement.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Cours au {data.dernierCours.date} : {parseFloat(data.dernierCours.prix_once).toFixed(2)} $/oz</p>
                  </> : <p className="text-xs text-slate-400">Aucun cours entré</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'transaction' && (
          <form onSubmit={handleSubmitTransaction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={inputCls} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Métal</label>
                <select value={form.metal} onChange={e => setForm({...form, metal: e.target.value})} className={inputCls}>
                  <option value="or">Or</option>
                  <option value="argent">Argent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className={inputCls}>
                  <option value="achat">Achat</option>
                  <option value="vente">Vente</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Quantité (oz)</label>
                <input type="number" step="0.0001" value={form.quantite} onChange={e => setForm({...form, quantite: e.target.value})}
                  className={`${inputCls} text-right`} placeholder="1.0000" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Prix/oz ($CAD)</label>
                <input type="number" step="0.01" value={form.prix_once} onChange={e => setForm({...form, prix_once: e.target.value})}
                  className={`${inputCls} text-right`} placeholder="0.00" required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors">
              {loading ? 'Enregistrement...' : 'Enregistrer la transaction'}
            </button>
          </form>
        )}

        {activeTab === 'cours' && (
          <form onSubmit={handleSubmitCours} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
              <input type="date" value={coursForm.date} onChange={e => setCoursForm({...coursForm, date: e.target.value})} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Métal</label>
              <select value={coursForm.metal} onChange={e => setCoursForm({...coursForm, metal: e.target.value})} className={inputCls}>
                <option value="or">Or</option>
                <option value="argent">Argent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Prix spot ($CAD/oz)</label>
              <input type="number" step="0.01" value={coursForm.prix_once} onChange={e => setCoursForm({...coursForm, prix_once: e.target.value})}
                className={`${inputCls} text-right`} placeholder="0.00" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors">
              {loading ? 'Enregistrement...' : 'Mettre à jour le cours'}
            </button>
          </form>
        )}

        {activeTab === 'historique' && (
          <div className="flex flex-col gap-2">
            {transactions.length === 0 && <p className="text-slate-400 text-center py-8 text-sm">Aucune transaction</p>}
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-semibold text-sm text-slate-800 capitalize">{t.metal} — {t.type}</p>
                  <p className="text-xs text-slate-400">{t.date} · {parseFloat(t.quantite).toFixed(4)} oz @ {parseFloat(t.prix_once).toFixed(2)} $/oz</p>
                </div>
                <span className={`font-bold text-sm ${t.type === 'achat' ? 'text-red-500' : 'text-emerald-600'}`}>
                  {t.type === 'achat' ? '-' : '+'}{(parseFloat(t.quantite) * parseFloat(t.prix_once)).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}