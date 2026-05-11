import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('code')
      setCategories(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return { categories, loading }
}