const express = require("express");
const router = express.Router();
const { GROUP_OPTIONS } = require("../constants/groups");

router.get("/", async (_req, res) => {
  res.json({ items: GROUP_OPTIONS });
});

module.exports = router;
