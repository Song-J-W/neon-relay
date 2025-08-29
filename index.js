import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon에 연결 시 인증서 문제로 실패하면 아래 옵션으로 우회 가능(비권장: 보안 약화)
  ssl: { rejectUnauthorized: false }
});

const app = express();
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT now()");
    res.json({ ok: true, now: rows[0].now });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/update", async (req, res) => {
  // 예: body { id: 1, score: 100 }
  const { id, score } = req.body;
  try {
    await pool.query("UPDATE users SET score = $1 WHERE id = $2", [score, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
