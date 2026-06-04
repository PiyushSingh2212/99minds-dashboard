import { useState, useEffect, useCallback } from 'react';
import { getLeads } from '../lib/api';

export default function useLeads() {
  const [leads, setLeads]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    search: '',
    minScore: '',
    maxScore: '',
    matchesIcp: '',
    industry: '',
    contacted: '',
    sort: '-icpScore',
  });

  const load = useCallback(async (f = filters) => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      const data = await getLeads(params);
      setLeads(data.leads);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(filters); }, [filters]);

  const update = (patch) => setFilters(f => ({ ...f, ...patch, page: 1 }));
  const setPage = (p) => setFilters(f => ({ ...f, page: p }));

  return { leads, total, pages, loading, filters, update, setPage, refresh: () => load(filters) };
}
