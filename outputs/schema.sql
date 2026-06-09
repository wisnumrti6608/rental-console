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
