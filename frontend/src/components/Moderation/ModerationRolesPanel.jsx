import { useState, useEffect, useCallback } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, VStack, HStack, Input, InputGroup, InputLeftElement, Text, Button, Checkbox, Spinner, Divider } from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { fetchAdminRolesCatalog, fetchAdminUserRoles, putAdminUserRoles, putAdminUserAdminFlag, searchUsersForAdmin } from "../../api/moderation";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { SEARCH_DEBOUNCE_MS } from "../../constants/timing";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

export default function ModerationRolesPanel() {
  const { toast } = useAppToast();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [rolesCatalog, setRolesCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState(() => new Set());
  const [selectedIsAdmin, setSelectedIsAdmin] = useState(false);
  const [loadingUserRoles, setLoadingUserRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const isBasicUser = selectedRoleIds.size === 0 && !selectedIsAdmin;

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setCatalogLoading(true);
        const data = await fetchAdminRolesCatalog();
        if (!abort) setRolesCatalog(data.items || []);
      } catch (e) {
        console.error(e);
        if (!abort) {
          toast({ status: "error", title: "Napaka", description: e.message || "Branje vlog ni uspelo." });
        }
      } finally {
        if (!abort) setCatalogLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [toast]);

  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const ac = new AbortController();
    setSearching(true);
    searchUsersForAdmin(debouncedQuery, { signal: ac.signal })
      .then((rows) => {
        if (ac.signal.aborted) return;
        setSearchResults(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        console.error(e);
        toast({ status: "error", title: "Iskanje", description: e.message || "Napaka." });
        setSearchResults([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setSearching(false);
      });
    return () => ac.abort();
  }, [debouncedQuery, toast]);

  const loadUserRoles = useCallback(async (userId) => {
    setLoadingUserRoles(true);
    try {
      const data = await fetchAdminUserRoles(userId);
      const ids = new Set((data.roles || []).map((r) => Number(r.id)));
      setSelectedRoleIds(ids);
      setSelectedUser(data.user);
      setSelectedIsAdmin(Boolean(data.user?.isAdmin));
    } catch (e) {
      console.error(e);
      toast({ status: "error", title: "Napaka", description: e.message || "Branje vlog uporabnika ni uspelo." });
      setSelectedUser(null);
      setSelectedRoleIds(new Set());
      setSelectedIsAdmin(false);
    } finally {
      setLoadingUserRoles(false);
    }
  }, [toast]);

  const toggleRole = (roleId) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedUser?.id) return;
    setSaving(true);
    try {
      const roleIds = [...selectedRoleIds];
      await putAdminUserAdminFlag(selectedUser.id, selectedIsAdmin);
      await putAdminUserRoles(selectedUser.id, roleIds);
      toast({ status: "success", title: "Shranjeno", description: "Vloge so posodobljene." });
      await loadUserRoles(selectedUser.id);
    } catch (e) {
      console.error(e);
      toast({ status: "error", title: "Shranjevanje", description: e.message || "Ni uspelo." });
    } finally {
      setSaving(false);
    }
  };

  if (catalogLoading) {
    return (
      <Box py={10} textAlign="center">
        <Spinner color="pink.500" />
      </Box>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Text fontSize="sm" color="gray.600">
        Poišči uporabnika po uporabniškem imenu, nato potrdi vloge in shrani.
      </Text>
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.400" />
        </InputLeftElement>
        <Input
          placeholder="Vsaj 2 znaka …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={INPUT_LIMITS.USER_SEARCH}
          rounded="xl"
          borderColor="gray.200"
        />
      </InputGroup>
      {searching && (
        <HStack>
          <Spinner size="sm" color="pink.400" />
          <Text fontSize="sm" color="gray.500">Iskanje …</Text>
        </HStack>
      )}
      {query.trim().length >= 2 && !searching && searchResults.length === 0 && (
        <Text fontSize="sm" color="gray.500">Ni zadetkov.</Text>
      )}
      {searchResults.length > 0 && (
        <VStack align="stretch" spacing={1} maxH="200px" overflowY="auto">
          {searchResults.map((u) => (
            <Button
              key={u.id}
              size="sm"
              variant={selectedUser?.id === u.id ? "solid" : "ghost"}
              colorScheme={selectedUser?.id === u.id ? "pink" : "gray"}
              justifyContent="flex-start"
              fontWeight="600"
              onClick={() => loadUserRoles(u.id)}
            >
              {u.username}
            </Button>
          ))}
        </VStack>
      )}

      <Divider />

      {!selectedUser ? (
        <Text fontSize="sm" color="gray.500">Izberi uporabnika zgoraj.</Text>
      ) : loadingUserRoles ? (
        <Spinner color="pink.500" />
      ) : (
        <VStack align="stretch" spacing={4}>
          <Box>
            <Text fontWeight="800" color="gray.800">{selectedUser.username}</Text>
            <Text fontSize="xs" color="gray.500">ID: {selectedUser.id}</Text>
          </Box>
          <Text fontSize="sm" fontWeight="700" color="gray.700">Vloge</Text>
          <VStack align="stretch" spacing={2}>
            <Checkbox
              isChecked={isBasicUser}
              onChange={(e) => {
                const checked = e.target.checked;
                if (!checked) return;
                setSelectedRoleIds(new Set());
                setSelectedIsAdmin(false);
              }}
              colorScheme="pink"
            >
              <Text as="span" fontWeight="600">Uporabnik</Text>
            </Checkbox>
            <Checkbox
              isChecked={selectedIsAdmin}
              onChange={(e) => {
                const checked = e.target.checked;
                setSelectedIsAdmin(checked);
              }}
              colorScheme="pink"
            >
              <Text as="span" fontWeight="600">Administrator</Text>
            </Checkbox>
            {rolesCatalog.map((r) => (
              <Checkbox
                key={r.id}
                isChecked={selectedRoleIds.has(Number(r.id))}
                onChange={() => toggleRole(Number(r.id))}
                colorScheme="pink"
              >
                <Text as="span" fontWeight="600">{r.name}</Text>
                {Array.isArray(r.permissions) && r.permissions.length > 0 && (
                  <Text as="span" fontSize="xs" color="gray.500" display="block" mt={0.5}>
                    {(r.permissions || []).join(", ")}
                  </Text>
                )}
              </Checkbox>
            ))}
          </VStack>
          <Button
            colorScheme="pink"
            onClick={handleSave}
            isLoading={saving}
            alignSelf={{ base: "stretch", md: "flex-start" }}
            w={{ base: "full", md: "auto" }}
            rounded="xl"
          >
            Shrani vloge
          </Button>
        </VStack>
      )}
    </VStack>
  );
}
