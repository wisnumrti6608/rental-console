# Sistem Informasi Rental Console

## Deskripsi

Sistem Informasi Rental Console adalah aplikasi berbasis web yang digunakan untuk mengelola penyewaan console secara lebih terstruktur. Sistem ini dapat mencatat transaksi, menghitung biaya sewa, menyimpan riwayat penggunaan, dan menampilkan status ketersediaan console.

## Latar Belakang

Beberapa tempat rental console masih menggunakan sistem manual dalam mengatur waktu bermain dan mencatat transaksi. Hal ini menyebabkan riwayat penggunaan dan data transaksi sulit dikelola. Oleh karena itu, dibuat sistem berbasis database untuk membantu pengelolaan data secara lebih efektif.

## Fitur

* Menampilkan status console (tersedia / digunakan)
* Input nama pelanggan
* Pemilihan console
* Input durasi bermain
* Perhitungan biaya otomatis
* Penyimpanan data transaksi
* Riwayat transaksi (history)

## Teknologi yang Digunakan

* HTML
* CSS
* JavaScript
* Node.js
* Express.js
* SQLite

## Struktur Database

### Tabel Console

| Field         | Keterangan     |
| ------------- | -------------- |
| id_con        | ID Console     |
| nama_console  | Nama Console   |
| tarif_per_jam | Tarif per Jam  |
| status        | Status Console |

### Tabel Transaksi

| Field          | Keterangan     |
| -------------- | -------------- |
| id_transaksi   | ID Transaksi   |
| nama_pelanggan | Nama Pelanggan |
| id_con         | ID Console     |
| jam_mulai      | Waktu Mulai    |
| jam_selesai    | Waktu Selesai  |
| durasi         | Lama Bermain   |
| total_bayar    | Total Biaya    |

## Cara Menjalankan

1. Install dependencies

```bash
npm install
```

2. Jalankan server

```bash
npm start
```

3. Buka browser

```text
http://localhost:3000/playstation-status.html
```

## Diagram Sistem

Perancangan sistem menggunakan:

* DFD Top Level
* DFD Level 0
* DFD Level 1
* DFD Level 2
* ERD (Entity Relationship Diagram)

## Tujuan Sistem

* Mempermudah pengelolaan rental console
* Menyimpan riwayat transaksi
* Menampilkan status penggunaan console
* Mengurangi kesalahan pencatatan secara manual

## Pengembang

Proyek ini dibuat sebagai tugas Sistem Basis Data / TIK.
