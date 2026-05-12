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

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Import CSV</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Fichier CSV (CIBC ou BMO)</label>
        <input type="file" accept=".csv" onChange={handleFile}
          className="w-full border rounded-lg p-2 text-sm" />
      </div>

      {transactions.length > 0 && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-blue-800 mb-2">Assignation par défaut</p>
            <div className="flex gap-2 mb-2">
              <select value={defaultCat} onChange={e => setDefaultCat(e.target.value)}
                className="flex-1 border rounded-lg p-2 text-sm">
                <option value="">— Catégorie —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
              <select value={defaultCompte} onChange={e => setDefaultCompte(e.target.value)}
                className="flex-1 border rounded-lg p-2 text-sm">
                <option value="">— Compte —</option>
                {comptes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={applyDefaults}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm">
              Appliquer à toutes
            </button>
          </div>

          <div className="space-y-2 mb-4">
            {transactions.map((t, i) => (
              <div key={i} className={`border rounded-xl p-3 ${doublons.has(i) ? 'border-orange-300 bg-orange-50' : 'bg-white'}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={!!selected[i]}
                    onChange={e => setSelected({ ...selected, [i]: e.target.checked })}
                    className="mt-1" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium truncate max-w-[180px]">{t.description}</span>
                      <span className={`text-sm font-bold ${t.montant > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {t.montant > 0 ? '-' : '+'}{Math.abs(t.montant).toFixed(2)} $
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">{t.date} · {t.source}
                      {doublons.has(i) && <span className="ml-2 text-orange-500 font-medium">⚠ doublon probable</span>}
                    </div>
                    {selected[i] && (
                      <div className="flex gap-2">
                        <select value={catAssign[i] || ''} onChange={e => setCatAssign({ ...catAssign, [i]: e.target.value })}
                          className="flex-1 border rounded p-1 text-xs">
                          <option value="">— Catégorie —</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                        </select>
                        <select value={compteAssign[i] || ''} onChange={e => setCompteAssign({ ...compteAssign, [i]: e.target.value })}
                          className="flex-1 border rounded p-1 text-xs">
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
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold">
            {importing ? 'Importation...' : `Importer ${nbSelected} transaction${nbSelected > 1 ? 's' : ''}`}
          </button>
        </>
      )}

      {status === 'success' && <p className="text-green-600 text-center mt-4">✅ Import réussi</p>}
      {status === 'error' && <p className="text-red-600 text-center mt-4">❌ Erreur — voir console</p>}
    </div>
  )
}