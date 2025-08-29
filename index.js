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

// 동적 테이블 업로드 엔드포인트 (유니티 스타일)
app.post('/api/upload/:tableName', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { tableName } = req.params;
    const { data, queryTail } = req.body;

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return res.status(400).json({
        error: 'data object is required and must not be empty'
      });
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({
        error: 'Invalid table name format'
      });
    }

    const columns = Object.keys(data).join(', ');
    // ✅ 파라미터 플레이스홀더 수정
    const paramPlaceholders = Object.keys(data).map((_, index) => `$${index + 1}`).join(', ');
    
    let sql = `INSERT INTO public.${tableName} (${columns}) VALUES (${paramPlaceholders})`;
    
    if (queryTail && typeof queryTail === 'string' && queryTail.trim()) {
      sql += ` ${queryTail.trim()}`;
    }

    const values = Object.values(data).map(value => 
      value === null || value === undefined ? null : value
    );

    console.log('Generated SQL:', sql);
    console.log('Values:', values);

    const result = await client.query(sql, values);
    
    res.status(201).json({
      success: true,
      message: 'Data uploaded to Neon DB!',
      tableName,
      rowsAffected: result.rowCount,
      returnedData: result.rows.length > 0 ? result.rows : undefined
    });

  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message,
      detail: error.detail || 'Database operation failed'
    });
  } finally {
    client.release();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
