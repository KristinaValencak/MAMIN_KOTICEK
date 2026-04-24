import { useState, useEffect, useCallback } from "react";
import { useAppToast } from "../context/ApiAlertModalContext.jsx";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";
import { getStoredUser } from "../utils/helpers";
import { mergeMeResponseIntoUser } from "../utils/authz";
import { parseApiErrorResponse } from "../utils/parseApiError.js";

export function useMeAccount() {
  const navigate = useNavigate();
  const { toast, confirm } = useAppToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    bio: "",
  });

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      navigate("/prijava");
      return;
    }

    let abort = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/users/me`, { credentials: "include" });
        if (res.status === 401) {
          localStorage.removeItem("user");
          window.dispatchEvent(new Event("auth-changed"));
          navigate("/prijava");
          return;
        }
        if (!res.ok) throw new Error("Napaka pri branju profila");
        const data = await res.json();
        if (abort) return;
        setUser(data);
        const prev = getStoredUser();
        const merged = mergeMeResponseIntoUser(prev, data);
        if (merged) {
          localStorage.setItem("user", JSON.stringify(merged));
          window.dispatchEvent(new Event("auth-changed"));
        }
        setFormData({
          username: data.username || "",
          email: data.email || "",
          password: "",
          confirmPassword: "",
          bio: data.bio || "",
        });
      } catch (err) {
        console.error(err);
        if (!abort) {
          toast({
            status: "error",
            title: "Napaka pri nalaganju profila",
            description: err.message,
          });
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [navigate, toast]);

  const handleSaveField = useCallback(
    async (field) => {
      try {
        setSaving(true);
        const updateData = {};
        if (field === "username") {
          updateData.username = formData.username.trim();
        } else if (field === "email") {
          updateData.email = formData.email.trim();
        } else if (field === "password") {
          if (formData.password) {
            updateData.password = formData.password;
          } else {
            toast({ status: "error", title: "Vnesite novo geslo" });
            return;
          }
        } else if (field === "bio") {
          updateData.bio = formData.bio ? formData.bio.trim() : null;
        }

        const res = await fetch(`${API_BASE}/api/users/me`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(updateData),
        });

        if (res.status === 409) {
          const pe = await parseApiErrorResponse(res);
          toast({
            status: "error",
            title: pe.message || "Uporabnik z tem emailom ali uporabniškim imenom že obstaja",
          });
          return;
        }

        if (!res.ok) {
          const pe = await parseApiErrorResponse(res);
          throw new Error(pe.message || "Napaka pri posodabljanju profila");
        }
        const data = await res.json();

        if (field === "email" && data.emailChanged) {
          toast({
            status: "success",
            title: "Email spremenjen!",
            description: `Na email naslov ${data.email} smo poslali verifikacijsko povezavo.\n\nProsim preveri svoj email in klikni na povezavo.\n\nSedaj boste odjavljeni.`,
            duration: null,
            onAfterClose: () => {
              localStorage.removeItem("user");
              window.dispatchEvent(new Event("auth-changed"));
              navigate("/prijava");
            },
          });
          return;
        }

        const storedUser = getStoredUser();
        if (storedUser) {
          const updatedUser = { ...storedUser, ...data };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          window.dispatchEvent(new Event("auth-changed"));
        }

        setUser(data);
        setEditingField(null);

        if (field === "password") {
          setFormData((fd) => ({
            ...fd,
            password: "",
            confirmPassword: "",
          }));
        } else {
          setFormData((fd) => ({
            ...fd,
            [field]: data[field] !== undefined ? data[field] || "" : fd[field],
          }));
        }

        toast({ status: "success", title: data.message || "Profil uspešno posodobljen" });
      } catch (err) {
        console.error(err);
        toast({
          status: "error",
          title: "Napaka pri posodabljanju profila",
          description: err.message,
        });
      } finally {
        setSaving(false);
      }
    },
    [formData, toast, navigate]
  );

  const updatePrivacyToggle = useCallback(
    async (patch) => {
      try {
        setSaving(true);
        const res = await fetch(`${API_BASE}/api/users/me`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const pe = await parseApiErrorResponse(res);
          throw new Error(pe.message || "Napaka pri posodabljanju nastavitev");
        }
        const data = await res.json();
        setUser(data);
        const storedUser = getStoredUser();
        if (storedUser) {
          const updatedUser = { ...storedUser, ...data };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          window.dispatchEvent(new Event("auth-changed"));
        }
        toast({ status: "success", title: "Nastavitve shranjene" });
      } catch (err) {
        console.error(err);
        toast({ status: "error", title: "Napaka", description: err.message });
      } finally {
        setSaving(false);
      }
    },
    [toast]
  );

  const handleDeleteAccount = useCallback(async () => {
    const ok = await confirm({
      title: "Izbriši račun?",
      description:
        "• Vaš račun bo trajno izbrisan (deaktiviran)\n• Osebni podatki bodo anonimizirani\n• Vaše objave, komentarji in oglasi ne bodo več javno vidni v aplikaciji\n\nAli ste prepričani?\n\nZa potrditev spodaj vnesite natančno besedo IZBRIŠI.",
      destructive: true,
      confirmText: "Da, izbriši račun!",
      cancelText: "Prekliči",
      requireExactText: "IZBRIŠI",
      inputPlaceholder: 'Vnesite "IZBRIŠI"',
    });

    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const pe = await parseApiErrorResponse(res);
        throw new Error(pe.message || "Napaka pri brisanju računa");
      }
      toast({
        status: "success",
        title: "Račun izbrisan",
        description: "Vaš račun je bil uspešno izbrisan.",
        duration: null,
        onAfterClose: () => {
          localStorage.removeItem("user");
          window.dispatchEvent(new Event("auth-changed"));
          navigate("/");
        },
      });
    } catch (err) {
      console.error(err);
      toast({
        status: "error",
        title: "Napaka",
        description: err.message || "Napaka pri brisanju računa",
      });
    }
  }, [navigate, toast, confirm]);

  return {
    user,
    loading,
    saving,
    formData,
    setFormData,
    editingField,
    setEditingField,
    handleSaveField,
    updatePrivacyToggle,
    handleDeleteAccount,
  };
}
