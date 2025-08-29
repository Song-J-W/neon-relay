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

    // 입력 검증
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return res.status(400).json({
        error: 'data object is required and must not be empty'
      });
    }

    // 테이블명 보안 검증 (SQL 인젝션 방지)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({
        error: 'Invalid table name format'
      });
    }

    // 컬럼명과 파라미터 동적 생성 (유니티 로직과 동일)
    const columns = Object.keys(data).join(', ');
    const paramPlaceholders = Object.keys(data).map((_, index) => `${index + 1}`).join(', ');
    
    // 기본 SQL 생성
    let sql = `INSERT INTO public.${tableName} (${columns}) VALUES (${paramPlaceholders})`;
    
    // queryTail 추가 (예: RETURNING, ON CONFLICT 등)
    if (queryTail && typeof queryTail === 'string' && queryTail.trim()) {
      sql += ` ${queryTail.trim()}`;
    }

    // 파라미터 값 배열 생성
    const values = Object.values(data).map(value => {
      // null 값 처리
      return value === null || value === undefined ? null : value;
    });

    console.log('Generated SQL:', sql);
    console.log('Values:', values);

    const result = await client.query(sql, values);
    
    res.status(201).json({
      success: true,
      message: 'Data uploaded to Neon DB!',
      tableName,
      rowsAffected: result.rowCount,
      // RETURNING 절이 있을 경우 결과 포함
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
