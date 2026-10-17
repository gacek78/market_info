#!/usr/bin/env python3
"""Stan prawdziwego portfela z bazy aplikacji `portfel` — dla /portfel.

Czyta /portfel-data/portfolio.db (wolumen :ro z /compose/portfel/backend/data).
Baza jest w trybie WAL, a z montowania tylko do odczytu SQLite nie otworzy jej
poprawnie — dlatego kopiujemy plik bazy i dziennik WAL do katalogu tymczasowego.

Wypisuje JSON. Użycie: python3 portfel-stan.py
"""
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from collections import defaultdict

DB = os.environ.get('PORTFEL_DB', '/portfel-data/portfolio.db')
XTB_SOURCES = ('xtb', 'import')  # to samo co XTB_SOURCES w portfel/backend/services/portfolio.py


def otworz_kopie() -> tuple[sqlite3.Connection, str]:
    tmp = tempfile.mkdtemp(prefix='portfel-')
    for suf in ('', '-wal'):
        if os.path.exists(DB + suf):
            shutil.copy2(DB + suf, os.path.join(tmp, 'portfolio.db' + suf))
    return sqlite3.connect(os.path.join(tmp, 'portfolio.db')), tmp


def main() -> None:
    if not os.path.exists(DB):
        print(json.dumps({'blad': f'brak bazy {DB} — sprawdź wolumen w docker-compose.yml'}, ensure_ascii=False))
        sys.exit(1)
    con, tmp = otworz_kopie()
    try:
        q = lambda sql, *a: con.execute(sql, a).fetchall()
        ustawienia = {k: v for k, v in q('select key, value from settings')}

        def js(klucz):
            try:
                return json.loads(ustawienia.get(klucz) or 'null')
            except ValueError:
                return None

        ph = ','.join('?' * len(XTB_SOURCES))

        # Pozycje IKE (XTB): ilość = kupione − sprzedane; wkład = wydane − odzyskane (PLN)
        pozycje = []
        for ticker, ilosc, wklad in q(f"""
            select ticker,
                   sum(case type when 'BUY' then quantity else -quantity end),
                   sum(case type when 'BUY' then total_pln else -total_pln end)
            from transactions
            where source in ({ph}) and type in ('BUY','SELL')
            group by ticker""", *XTB_SOURCES):
            if round(ilosc, 6) > 0:
                pozycje.append({'ticker': ticker, 'ilosc': round(ilosc, 4), 'wklad_pln': round(wklad, 2)})

        # Zakupy i wpłaty IKE wg miesięcy — ostatnie 6 miesięcy
        zakupy = defaultdict(lambda: {'kwota_pln': 0.0, 'pozycje': defaultdict(float)})
        for data, ticker, kwota in q(f"""
            select date, ticker, total_pln from transactions
            where source in ({ph}) and type = 'BUY' order by date""", *XTB_SOURCES):
            m = zakupy[data[:7]]
            m['kwota_pln'] += kwota
            m['pozycje'][ticker] += kwota
        zakupy_out = {
            k: {'kwota_pln': round(v['kwota_pln'], 2),
                'pozycje': {t: round(x, 2) for t, x in v['pozycje'].items()}}
            for k, v in sorted(zakupy.items())[-6:]
        }
        wplaty = {m: round(s, 2) for m, s in q(f"""
            select substr(date,1,7), sum(total_pln) from transactions
            where source in ({ph}) and type = 'DEPOSIT'
            group by 1 order by 1 desc limit 6""", *XTB_SOURCES)}

        (ost_xtb,), = q(f"select max(date) from transactions where source in ({ph})", *XTB_SOURCES)
        (ost_import,), = q('select max(created_at) from transactions')

        print(json.dumps({
            'zrodlo': 'baza aplikacji portfel (tylko odczyt)',
            'swiezosc': {
                'ostatnia_transakcja_ike': ost_xtb,
                'ostatni_import_do_bazy': ost_import,
                'uwaga': 'Baza zna tylko to, co zaimportowano z eksportu XTB. '
                         'Zakupy po dacie ostatniego importu nie są tu widoczne.',
            },
            'ike': {
                'budzet_miesieczny_pln': float(ustawienia.get('monthly_budget_xtb') or 0),
                'cel_procent': js('target_allocation_xtb'),
                'pozycje': sorted(pozycje, key=lambda p: -p['wklad_pln']),
                'zakupy_wg_miesiaca': zakupy_out,
                'wplaty_wg_miesiaca': wplaty,
            },
        }, ensure_ascii=False, indent=1))
    finally:
        con.close()
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
