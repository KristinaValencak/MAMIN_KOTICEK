const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const emailService = require("../services/emailService");
const L = require("../constants/inputLimits");
const { rejectIfStringTooLong } = require("../utils/rejectIfStringTooLong");
const { contactPostIpLimiter } = require("../middleware/rateLimiters");

router.post("/", contactPostIpLimiter, async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !name.trim()) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Ime je obvezno.");
        }
        if (!email || !email.trim()) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Email je obvezen.");
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven email naslov.");
        }
        if (!subject || !subject.trim()) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Zadeva je obvezna.");
        }
        if (!message || !message.trim()) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Sporočilo je obvezno.");
        }
        if (rejectIfStringTooLong(res, name.trim(), L.CONTACT_NAME, "Ime")) return;
        if (rejectIfStringTooLong(res, email.trim(), L.EMAIL, "Email")) return;
        if (rejectIfStringTooLong(res, subject.trim(), L.CONTACT_SUBJECT, "Zadeva")) return;
        if (rejectIfStringTooLong(res, message.trim(), L.CONTACT_MESSAGE, "Sporočilo")) return;

        await emailService.sendContactEmail(
            name.trim(),
            email.trim(),
            subject.trim(),
            message.trim()
        );

        res.status(200).json({ message: "Sporočilo uspešno poslano." });
    } catch (err) {
        console.error("Napaka pri pošiljanju kontaktnega sporočila:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri pošiljanju sporočila.");
    }
});

module.exports = router;