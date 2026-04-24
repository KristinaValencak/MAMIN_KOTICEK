import { useState, useEffect } from "react";
import { API_BASE } from "../../api/config";

export const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    async function loadCategories() {
      try {
        const res = await fetch(`${API_BASE}/api/categories`);
        if (!res.ok) throw new Error("Napaka pri branju kategorij");
        const data = await res.json();
        if (!abort) setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!abort) setLoading(false);
      }
    }
    loadCategories();
    return () => { abort = true; };
  }, []);

  return { categories, loading };
};
