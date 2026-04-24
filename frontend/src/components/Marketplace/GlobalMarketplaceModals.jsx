import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton } from "@chakra-ui/react";
import { getStoredUser } from "../../utils/helpers";
import { useAuthGate } from "../../context/AuthGateContext";
import ListingForm from "./ListingForm";
import ListingDetailView from "./ListingDetailView";
import { OPEN_LISTING_DETAIL_MODAL, OPEN_LISTING_FORM_MODAL } from "./marketplaceModalConstants";

export { OPEN_LISTING_FORM_MODAL, OPEN_LISTING_DETAIL_MODAL } from "./marketplaceModalConstants";

export default function GlobalMarketplaceModals() {
  const { requestAuth } = useAuthGate();
  const reopenDetailAfterFormRef = useRef(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formEditId, setFormEditId] = useState(null);
  const [formKey, setFormKey] = useState(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailListingId, setDetailListingId] = useState(null);
  const [detailKey, setDetailKey] = useState(0);
  const [detailNotifId, setDetailNotifId] = useState(null);
  const [detailBannerKey, setDetailBannerKey] = useState(null);

  const openDetail = useCallback((listingId, { notifId = null, bannerKey = null } = {}) => {
    const id = Number(listingId);
    if (!Number.isFinite(id) || id <= 0) return;
    setFormOpen(false);
    setDetailListingId(id);
    setDetailNotifId(notifId != null && String(notifId).trim() !== "" ? String(notifId) : null);
    setDetailBannerKey(bannerKey != null && String(bannerKey).trim() !== "" ? String(bannerKey) : null);
    setDetailKey((k) => k + 1);
    setDetailOpen(true);
  }, []);

  const openForm = useCallback(
    (detail = {}) => {
      if (!getStoredUser()) {
        requestAuth({ tab: "login", reason: "Za urejanje ali oddajo oglasa na marketplace se morate prijaviti." });
        return;
      }
      const rawEdit = detail?.editId;
      const editId = rawEdit != null && rawEdit !== "" ? Number(rawEdit) : null;
      const rawFd = detail?.fromDetailListingId;
      const fromDetail =
        rawFd != null && rawFd !== "" ? Number(rawFd) : null;
      if (Number.isFinite(fromDetail) && fromDetail > 0) {
        reopenDetailAfterFormRef.current = fromDetail;
      } else {
        reopenDetailAfterFormRef.current = null;
      }
      setDetailOpen(false);
      setFormEditId(Number.isFinite(editId) && editId > 0 ? editId : null);
      setFormKey((k) => k + 1);
      setFormOpen(true);
    },
    [requestAuth]
  );

  useEffect(() => {
    const onForm = (e) => openForm(e?.detail || {});
    const onDetail = (e) => {
      const id = e?.detail?.listingId;
      const notifId = e?.detail?.notifId ?? null;
      const bannerKey = e?.detail?.bannerKey ?? null;
      openDetail(id, { notifId, bannerKey });
    };
    window.addEventListener(OPEN_LISTING_FORM_MODAL, onForm);
    window.addEventListener(OPEN_LISTING_DETAIL_MODAL, onDetail);
    return () => {
      window.removeEventListener(OPEN_LISTING_FORM_MODAL, onForm);
      window.removeEventListener(OPEN_LISTING_DETAIL_MODAL, onDetail);
    };
  }, [openForm, openDetail]);

  const closeForm = useCallback(() => setFormOpen(false), []);
  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailNotifId(null);
    setDetailBannerKey(null);
  }, []);

  const handleListingFormSuccess = useCallback(
    ({ id, isEdit }) => {
      const reopen = reopenDetailAfterFormRef.current;
      reopenDetailAfterFormRef.current = null;
      closeForm();
      const nid = Number(id);
      if (Number.isFinite(reopen) && reopen > 0) {
        setTimeout(() => openDetail(reopen), 0);
        return;
      }
      if (!isEdit && Number.isFinite(nid) && nid > 0) {
        setTimeout(() => openDetail(nid), 0);
      }
    },
    [closeForm, openDetail]
  );

  return (
    <>
      <Modal isOpen={formOpen} onClose={closeForm} isCentered size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent borderRadius="xl" mx={3}>
          <ModalHeader fontSize="lg" fontWeight="800">
            {formEditId ? "Uredi oglas" : "Nov oglas"}
          </ModalHeader>
          <ModalCloseButton onMouseUp={(e) => e.currentTarget.blur()} />
          <ModalBody pb={6}>
            <ListingForm key={formKey} editId={formEditId} onSuccess={handleListingFormSuccess} onCancel={closeForm} />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={detailOpen} onClose={closeDetail} isCentered size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent borderRadius="xl" mx={3} maxW="4xl">
          <ModalHeader fontSize="lg" fontWeight="800">
            Oglas
          </ModalHeader>
          <ModalCloseButton onMouseUp={(e) => e.currentTarget.blur()} />
          <ModalBody pb={6}>
            {detailListingId != null ? (
              <ListingDetailView
                key={detailKey}
                listingId={detailListingId}
                onClose={closeDetail}
                notifId={detailNotifId}
                bannerKey={detailBannerKey}
              />
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

export function ListingFormLegacyRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/marketplace", { replace: true });
    if (getStoredUser()) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(OPEN_LISTING_FORM_MODAL, { detail: {} }));
      }, 0);
    }
  }, [navigate]);
  return null;
}

export function ListingDetailLegacyRedirect() {
  const navigate = useNavigate();
  const { id } = useParams();
  const listingId = Number(id);
  useEffect(() => {
    navigate("/marketplace", { replace: true });
    if (Number.isFinite(listingId) && listingId > 0) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(OPEN_LISTING_DETAIL_MODAL, { detail: { listingId } }));
      }, 0);
    }
  }, [navigate, listingId]);
  return null;
}

export function ListingEditLegacyRedirect() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editId = Number(id);
  useEffect(() => {
    navigate("/marketplace", { replace: true });
    if (getStoredUser() && Number.isFinite(editId) && editId > 0) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(OPEN_LISTING_FORM_MODAL, { detail: { editId } }));
      }, 0);
    }
  }, [navigate, editId]);
  return null;
}
