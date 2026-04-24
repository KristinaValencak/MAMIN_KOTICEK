import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { VStack, Text, Checkbox, FormControl, Textarea, Box } from "@chakra-ui/react";
import {
  REPORT_REASON_OPTIONS,
  OTHER_REASON_ID,
  REPORT_OTHER_TEXT_MAX,
  buildReportReason,
  isReportReasonValid,
} from "../../utils/reportReason";

const ReportReasonFields = forwardRef(function ReportReasonFields(
  {
    isActive,
    heading = "Zakaj prijavljate to vsebino?",
    focusBorderColor = "brand.500",
    textareaBorderRadius,
  },
  ref
) {
  const [selected, setSelected] = useState({});
  const [otherText, setOtherText] = useState("");

  useEffect(() => {
    if (!isActive) {
      setSelected({});
      setOtherText("");
    }
  }, [isActive]);

  useEffect(() => {
    if (!selected[OTHER_REASON_ID]) setOtherText("");
  }, [selected[OTHER_REASON_ID]]);

  const payload = useMemo(() => {
    const reason = buildReportReason(selected, otherText);
    const valid = isReportReasonValid(selected, otherText);
    return { reason, valid };
  }, [selected, otherText]);

  useImperativeHandle(
    ref,
    () => ({
      getReason: () => payload.reason,
      isValid: () => payload.valid,
    }),
    [payload]
  );

  const toggle = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const otherSelected = Boolean(selected[OTHER_REASON_ID]);
  const otherLen = otherText.length;

  return (
    <VStack spacing={4} align="stretch">
      <Text fontSize="sm" fontWeight="600" color="gray.800">
        {heading}
      </Text>
      <VStack align="stretch" spacing={2}>
        {REPORT_REASON_OPTIONS.map((opt) => (
          <Checkbox
            key={opt.id}
            isChecked={Boolean(selected[opt.id])}
            onChange={() => toggle(opt.id)}
            colorScheme="pink"
            size="md"
          >
            <Text as="span" fontSize="sm" color="gray.700">
              {opt.label}
            </Text>
          </Checkbox>
        ))}
      </VStack>
      {otherSelected ? (
        <FormControl>
          <Textarea
            value={otherText}
            onChange={(e) =>
              setOtherText(
                e.target.value.slice(0, REPORT_OTHER_TEXT_MAX)
              )
            }
            placeholder="Na kratko opišite …"
            rows={4}
            maxLength={REPORT_OTHER_TEXT_MAX}
            focusBorderColor={focusBorderColor}
            borderRadius={textareaBorderRadius}
          />
          <Box textAlign="right" mt={1}>
            <Text fontSize="xs" color="gray.500">
              {otherLen} / {REPORT_OTHER_TEXT_MAX}
            </Text>
          </Box>
        </FormControl>
      ) : null}
    </VStack>
  );
});

export default ReportReasonFields;
