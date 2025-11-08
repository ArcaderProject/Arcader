import express from "express";

const app = express.Router();

app.use("/health", (req, res) => {
    res.json({ status: "ok" });
});

export default app;
