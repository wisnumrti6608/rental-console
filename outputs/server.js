const fs = require("fs");
const http = require("http");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "rental_console.db");
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS Console (
    id_con INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_console TEXT NOT NULL UNIQUE,
    tarif_per_jam INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'available'
  );

  CREATE TABLE IF NOT EXISTS Transaksi (
    id_transaksi INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_pelanggan TEXT NOT NULL,
    id_con INTEGER NOT NULL,
    jam_mulai TEXT NOT NULL,
    jam_selesai TEXT NOT NULL,
    durasi INTEGER NOT NULL,
    total_bayar INTEGER NOT NULL,
    status_transaksi TEXT NOT NULL DEFAULT 'active',
    FOREIGN KEY (id_con) REFERENCES Console(id_con)
  );
`);

const transaksiColumns = db.prepare("PRAGMA table_info(Transaksi)").all();
if (!transaksiColumns.some((column) => column.name === "status_transaksi")) {
  db.exec("ALTER TABLE Transaksi ADD COLUMN status_transaksi TEXT NOT NULL DEFAULT 'active'");
}

const seedConsole = db.prepare(`
  INSERT OR IGNORE INTO Console (nama_console, tarif_per_jam, status)
  VALUES (?, ?, 'available')
`);

[
  ["PS1", 10000],
  ["PS2", 12000],
  ["PS3", 15000]
].forEach((item) => seedConsole.run(...item));

db.prepare(`
  SELECT
    t.id_transaksi,
    t.jam_mulai,
    t.durasi,
    t.total_bayar,
    c.tarif_per_jam
  FROM Transaksi t
  JOIN Console c ON c.id_con = t.id_con
`).all().forEach((row) => {
  const durasiSesuaiBayar = Math.round((row.total_bayar * 60) / row.tarif_per_jam);

  if (durasiSesuaiBayar > 0 && durasiSesuaiBayar !== row.durasi) {
    const jamSelesai = new Date(
      new Date(row.jam_mulai).getTime() + durasiSesuaiBayar * 60 * 1000
    ).toISOString();

    db.prepare(`
      UPDATE Transaksi
      SET durasi = ?,
          jam_selesai = ?,
          status_transaksi = 'finished'
      WHERE id_transaksi = ?
    `).run(durasiSesuaiBayar, jamSelesai, row.id_transaksi);
  }
});

function syncConsoleStatus() {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE Console
    SET status = 'available'
    WHERE id_con NOT IN (
      SELECT id_con
      FROM Transaksi
      WHERE jam_selesai > ?
        AND status_transaksi = 'active'
    )
  `).run(now);

  db.prepare(`
    UPDATE Console
    SET status = 'occupied'
    WHERE id_con IN (
      SELECT id_con
      FROM Transaksi
      WHERE jam_selesai > ?
        AND status_transaksi = 'active'
    )
  `).run(now);
}

function getConsoles() {
  syncConsoleStatus();

  return db.prepare(`
    SELECT
      c.id_con,
      c.nama_console,
      c.tarif_per_jam,
      c.status,
      t.nama_pelanggan,
      t.jam_mulai,
      t.jam_selesai
    FROM Console c
    LEFT JOIN Transaksi t ON t.id_transaksi = (
      SELECT tx.id_transaksi
      FROM Transaksi tx
      WHERE tx.id_con = c.id_con
        AND tx.jam_selesai > ?
        AND tx.status_transaksi = 'active'
      ORDER BY tx.jam_selesai DESC
      LIMIT 1
    )
    ORDER BY c.id_con
  `).all(new Date().toISOString());
}

function createTransaksi(body) {
  const namaPelanggan = String(body.nama_pelanggan || "").trim();
  const idCon = Number(body.id_con);
  const durasi = Number(body.durasi);

  if (!namaPelanggan) {
    return { status: 400, body: { error: "Nama pelanggan wajib diisi." } };
  }

  if (!Number.isInteger(idCon) || idCon <= 0) {
    return { status: 400, body: { error: "Console tidak valid." } };
  }

  if (!Number.isFinite(durasi) || durasi <= 0) {
    return { status: 400, body: { error: "Durasi tidak valid." } };
  }

  syncConsoleStatus();
  const consoleRow = db.prepare("SELECT * FROM Console WHERE id_con = ?").get(idCon);

  if (!consoleRow) {
    return { status: 404, body: { error: "Console tidak ditemukan." } };
  }

  if (consoleRow.status === "occupied") {
    return { status: 409, body: { error: "Console sedang occupied." } };
  }

  const jamMulaiDate = new Date();
  const jamSelesaiDate = new Date(jamMulaiDate.getTime() + durasi * 60 * 1000);
  const totalBayar = Math.ceil((consoleRow.tarif_per_jam * durasi) / 60);
  const jamMulai = jamMulaiDate.toISOString();
  const jamSelesai = jamSelesaiDate.toISOString();

  const result = db.prepare(`
    INSERT INTO Transaksi (
      nama_pelanggan,
      id_con,
      jam_mulai,
      jam_selesai,
      durasi,
      total_bayar,
      status_transaksi
    ) VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(namaPelanggan, idCon, jamMulai, jamSelesai, durasi, totalBayar);

  db.prepare("UPDATE Console SET status = 'occupied' WHERE id_con = ?").run(idCon);

  return {
    status: 201,
    body: {
      id_transaksi: Number(result.lastInsertRowid),
      nama_pelanggan: namaPelanggan,
      id_con: idCon,
      jam_mulai: jamMulai,
      jam_selesai: jamSelesai,
      durasi,
      total_bayar: totalBayar
    }
  };
}

function getTransaksi() {
  return db.prepare(`
    SELECT
      t.id_transaksi,
      t.nama_pelanggan,
      t.id_con,
      c.nama_console,
      t.jam_mulai,
      t.jam_selesai,
      t.durasi,
      t.total_bayar
    FROM Transaksi t
    JOIN Console c ON c.id_con = t.id_con
    ORDER BY t.id_transaksi DESC
  `).all();
}

function finishConsole(idCon) {
  const parsedId = Number(idCon);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return { status: 400, body: { error: "Console tidak valid." } };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const activeTransaction = db.prepare(`
    SELECT id_transaksi
    FROM Transaksi
    WHERE id_con = ?
      AND jam_selesai > ?
      AND status_transaksi = 'active'
    ORDER BY jam_selesai DESC
    LIMIT 1
  `).get(parsedId, nowIso);

  if (activeTransaction) {
    db.prepare(`
      UPDATE Transaksi
      SET status_transaksi = 'finished'
      WHERE id_transaksi = ?
    `).run(activeTransaction.id_transaksi);
  }

  db.prepare("UPDATE Console SET status = 'available' WHERE id_con = ?").run(parsedId);
  return { status: 200, body: { ok: true } };
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const requestedPath = urlPath === "/" ? "/playstation-status.html" : urlPath;
  const filePath = path.join(__dirname, requestedPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }

    const ext = path.extname(filePath);
    const type = ext === ".html" ? "text/html; charset=utf-8" : "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function httpHandler(req, res) {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === "OPTIONS") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/consoles") {
      return sendJson(res, 200, getConsoles());
    }

    if (req.method === "GET" && url.pathname === "/api/transaksi") {
      return sendJson(res, 200, getTransaksi());
    }

    if (req.method === "POST" && url.pathname === "/api/transaksi") {
      const result = createTransaksi(await readJson(req));
      return sendJson(res, result.status, result.body);
    }

    const finishMatch = url.pathname.match(/^\/api\/consoles\/(\d+)\/finish$/);
    if (req.method === "POST" && finishMatch) {
      const result = finishConsole(finishMatch[1]);
      return sendJson(res, result.status, result.body);
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

function startWithExpress(express) {
  const app = express();
  app.use(express.json());
  app.use(express.static(__dirname));

  app.get("/", (req, res) => res.redirect("/playstation-status.html"));
  app.get("/api/consoles", (req, res) => res.json(getConsoles()));
  app.get("/api/transaksi", (req, res) => res.json(getTransaksi()));
  app.post("/api/transaksi", (req, res) => {
    const result = createTransaksi(req.body);
    res.status(result.status).json(result.body);
  });
  app.post("/api/consoles/:id/finish", (req, res) => {
    const result = finishConsole(req.params.id);
    res.status(result.status).json(result.body);
  });

  app.listen(PORT, () => {
    console.log(`Rental console aktif di http://localhost:${PORT}`);
  });
}

try {
  startWithExpress(require("express"));
} catch (error) {
  http.createServer(httpHandler).listen(PORT, "127.0.0.1", () => {
    console.log(`Rental console aktif di http://localhost:${PORT}`);
  });
}
