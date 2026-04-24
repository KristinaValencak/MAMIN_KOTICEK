import { useEffect, useMemo, useRef, useState } from "react";
import { useAppToast } from "../../../context/ApiAlertModalContext.jsx";
import { HStack, Input, IconButton} from "@chakra-ui/react";
import { FiSend } from "react-icons/fi";
import { INPUT_LIMITS } from "../../../constants/inputLimits";

export default function MessageInput({ onSend, disabled, value, onChange, initialValue, onTyping, onFocusChange }) {
  const isControlled = useMemo(() => typeof value === "string" && typeof onChange === "function", [value, onChange]);
  const [innerValue, setInnerValue] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useAppToast();
  const typingStateRef = useRef(false);
  const typingStopTimeoutRef = useRef(null);

  useEffect(() => {
    if (isControlled) return;
    if (typeof initialValue === "string") setInnerValue(initialValue);
  }, [initialValue, isControlled]);

  const currentValue = isControlled ? value : innerValue;
  const setValue = isControlled ? onChange : setInnerValue;

  const fireTyping = (next) => {
    if (typeof onTyping !== "function") return;
    if (typingStateRef.current === next) return;
    typingStateRef.current = next;
    onTyping(next);
  };

  const scheduleTypingStop = () => {
    if (!typingStateRef.current) return;
    if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
    typingStopTimeoutRef.current = setTimeout(() => {
      typingStopTimeoutRef.current = null;
      fireTyping(false);
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
      fireTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onTyping is stable enough; cleanup best-effort
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const text = currentValue.trim();
    if (!text || disabled || sending) return;
    setSending(true);
    try {
      fireTyping(false);
      await onSend(text);
      setValue("");
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka pri pošiljanju",
        description: err.message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <HStack mt={0} spacing={2}>
        <Input
          placeholder="Napiši sporočilo..."
          value={currentValue}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            if (disabled || sending) return;
            if (next.trim().length > 0) {
              fireTyping(true);
              scheduleTypingStop();
            } else {
              fireTyping(false);
            }
          }}
          maxLength={INPUT_LIMITS.CHAT_MESSAGE}
          isDisabled={disabled || sending}
          bg="white"
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => {
            onFocusChange?.(false);
            fireTyping(false);
          }}
        />
        <IconButton
          type="submit"
          icon={<FiSend />}
          aria-label="Pošlji"
          colorScheme="pink"
          isLoading={sending}
          isDisabled={disabled}
        />
      </HStack>
    </form>
  );
}

