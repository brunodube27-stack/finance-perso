import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('name')
      setAccounts(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return { accounts, loading }
}




