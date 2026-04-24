const express = require("express");
const router = express.Router();
const { CITY_OPTIONS } = require("../constants/cities");

router.get("/", async (_req, res) => {
  // Public, stable list for frontend dropdowns.
  res.json({ items: CITY_OPTIONS });
});

module.exports = router;

