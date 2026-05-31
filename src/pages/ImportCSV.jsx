import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function parseCIBC(text) {
  return text.trim().split('\n').map(line => {
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) || []
    const date = cols[0]?.trim()
    const description = cols[1]?.replace(/"/g, '').trim()
    const montant = parseFloat(cols[2])
    if (!date || !description || isNaN(montant)) return null
    return { date, description, montant: montant, source: 'CIBC' }
  }).filter(Boolean)
}

function parseBMO(text) {
  const lines = text.trim().split('\n')
  const dataLines = lines.filter(l => l.startsWith("'"))
  return dataLines.map(line => {
    const cols = line.split(',')
    const type = cols[1]?.trim()
    const dateRaw = cols[2]?.trim()
    const montantRaw = parseFloat(cols[3])
    const description = cols.slice(4).join(',').replace(/"/g, '').trim()
    if (!dateRaw || isNaN(montantRaw)) return null
    const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    const montant = type === 'DEBIT' ? Math.abs(montantRaw) : -Math.abs(montantRaw)
    return { date, description, montant, source: 'BMO' }
  }).filter(Boolean)
}

function detectFormat(text) {
  if (text.includes('Maxi-Carte') || text.includes('Type de transaction')) return 'BMO'
  return 'CIBC'
}

export default function ImportCSV() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [comptes, setComptes] = useState([])
  const [selected, setSelected] = useState({})
  const [catAssign, setCatAssign] = useState({})
  const [compteAssign, setCompteAssign] = useState({})
  const [defaultCat, setDefaultCat] = useState('')
  const [defaultCompte, setDefaultCompte] = useState('')
  const [status, setStatus] = useState(null)
  const [doublons, setDoublons] = useState(new Set())
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const [{ data: cats }, { data: compteData }] = await Promise.all([
        supabase.from('categories').select('*').order('code'),
        supabase.from('accounts').select('*').order('name')
      ])
      setCategories(cats || [])
      setComptes(compteData || [])
    }
    fetchData()
  }, [])

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const format = detectFormat(text)
    const parsed = format === 'BMO' ? parseBMO(text) : parseCIBC(text)

    const { data: existing } = await supabase
      .from('transactions')
      .select('date, description, amount')
      .in('date', parsed.map(t => t.date))

    const doublonSet = new Set()
    parsed.forEach((t, i) => {
      const isDup = existing?.some(e =>
        e.date === t.date &&
        Math.abs(parseFloat(e.amount) - t.montant) < 0.01 &&
        e.description?.toLowerCase().includes(t.description.slice(0, 10).toLowerCase())
      )
      if (isDup) doublonSet.add(i)
    })

    setDoublons(doublonSet)
    setTransactions(parsed)

    const sel = {}
    parsed.forEach((_, i) => { sel[i] = !doublonSet.has(i) })
    setSelected(sel)
  }

  function applyDefaults() {
    const newCat = {}
    const newCompte = {}
    transactions.forEach((_, i) => {
      newCat[i] = defaultCat
      newCompte[i] = defaultCompte
    })
    setCatAssign(newCat)
    setCompteAssign(newCompte)
  }

  async function handleImport() {
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()

    const toImport = transactions
      .filter((_, i) => selected[i])
      .map((t) => {
        const i = transactions.indexOf(t)
        return {
          date: t.date,
          description: t.description,
          amount: t.montant,
          category_id: catAssign[i] || null,
          account_id: compteAssign[i] || null,
          user_id: user.id,
          type: 'expense',
          source: t.source,
        }
      })

    const { error } = await supabase.from('transactions').insert(toImport)
    if (error) { setStatus('error'); console.error(error) }
    else {
      setStatus('success')
      setTransactions([])
      setSelected({})
    }
    setImporting(false)
  }

  const nbSelected = Object.values(selected).filter(Boolean).length

  const selCls = "flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-indigo-400"

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Import CSV</h1>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fichier CSV (CIBC ou BMO)</label>
        <input type="file" accept=".csv" onChange={handleFile}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700" />
      </div>

      {transactions.length > 0 && (
        <>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">Assignation par défaut</p>
            <div className="flex gap-2 mb-3">
              <select value={defaultCat} onChange={e => setDefaultCat(e.target.value)}
                className="flex-1 border border-indigo-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                <option value="">— Catégorie —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
              <select value={defaultCompte} onChange={e => setDefaultCompte(e.target.value)}
                className="flex-1 border border-indigo-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                <option value="">— Compte —</option>
                {comptes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={applyDefaults}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
              Appliquer à toutes
            </button>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {transactions.map((t, i) => (
              <div key={i} className={`rounded-2xl border p-3 ${doublons.has(i) ? 'border-amber-200 bg-amber-50' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={!!selected[i]}
                    onChange={e => setSelected({ ...selected, [i]: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm font-medium text-slate-800 truncate">{t.description}</span>
                      <span className={`text-sm font-semibold whitespace-nowrap shrink-0 ${t.montant > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {t.montant > 0 ? '-' : '+'}{Math.abs(t.montant).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 mb-2">
                      {t.date} · {t.source}
                      {doublons.has(i) && <span className="ml-2 text-amber-600 font-semibold">⚠ doublon probable</span>}
                    </div>
                    {selected[i] && (
                      <div className="flex gap-2">
                        <select value={catAssign[i] || ''} onChange={e => setCatAssign({ ...catAssign, [i]: e.target.value })} className={selCls}>
                          <option value="">— Catégorie —</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                        </select>
                        <select value={compteAssign[i] || ''} onChange={e => setCompteAssign({ ...compteAssign, [i]: e.target.value })} className={selCls}>
                          <option value="">— Compte —</option>
                          {comptes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleImport} disabled={importing || nbSelected === 0}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-colors ${nbSelected > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
            {importing ? 'Importation...' : `Importer ${nbSelected} transaction${nbSelected > 1 ? 's' : ''}`}
          </button>
        </>
      )}

      {status === 'success' && <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-sm text-emerald-700 text-center mt-4">✓ Import réussi</div>}
      {status === 'error' && <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-sm text-red-600 text-center mt-4">Erreur — voir console</div>}
    </div>
  )
}