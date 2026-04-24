import { useEffect, useState } from "react";
import { API_BASE } from "../../api/config";

export function useGroups() {
  const [groups, setGroups] = useState([]); // [{ key, label }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/groups`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!abort) setGroups(items);
      } catch (e) {
        if (!abort) setError("Ne morem prebrati seznama skupin.");
        console.error(e);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  return { groups, loading, error };
}

