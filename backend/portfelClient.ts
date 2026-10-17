/**
 * portfelClient.ts — odczyt zakupów obligacji z aplikacji `portfel` (repo C:\projekty\portfel).
 *
 * Wycenę każdej serii (odsetki, kara za wcześniejszy wykup, Belka 19%) liczy portfel —
 * tu jej nie powtarzamy. Bierzemy `GET /api/portfolio/bonds/purchases`, gdzie każdy
 * zakup ma `exit_net_value` = wykup na rękę dziś, `net_value` = to samo bez kary
 * i `paid_coupons` = kupony już wypłacone.
 *
 * Konfiguracja (.env): PORTFEL_API_URL (np. http://portfel_api:8000/api) i
 * PORTFEL_TOKEN — ta sama wartość co INTERNAL_API_TOKEN w .env portfela.
 * Klucz daje dostęp tylko do tego jednego endpointu (bez hasła do portfela).
 */

export interface BondPurchase {
  ticker: string;
  date: string;          // RRRR-MM-DD
  quantity: number;      // sztuk po 100 zł nominału (po odjęciu umorzonych)
  exitNetValue: number;  // wykup na rękę dziś (po karze i Belce), PLN
  netValue: number;      // wartość dziś bez kary (po Belce) — gdy trzymasz dalej, PLN
  paidCouponsNet: number; // kupony już wypłacone, po Belce, PLN (COI/ROR/DOR; reszta 0)
  partlyRedeemed: boolean;
}

interface PortfelPosition {
  ticker: string;
  quantity: number;
  bond_purchases?: { date: string; quantity: number; net_value?: number; exit_net_value?: number; paid_coupons?: number }[];
}

const BELKA = 0.19;

export function isPortfelConfigured(): boolean {
  return Boolean(process.env.PORTFEL_API_URL && process.env.PORTFEL_TOKEN);
}

export async function pobierzZakupyObligacji(): Promise<BondPurchase[]> {
  if (!isPortfelConfigured()) {
    throw new Error('Brak PORTFEL_API_URL / PORTFEL_TOKEN w .env');
  }
  const base = process.env.PORTFEL_API_URL!.replace(/\/$/, '');
  const res = await fetch(`${base}/portfolio/bonds/purchases`, {
    headers: { 'X-Internal-Token': process.env.PORTFEL_TOKEN! },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`portfel: /portfolio/bonds/purchases HTTP ${res.status}`);
  const body = (await res.json()) as { positions?: PortfelPosition[] };
  const positions = body.positions ?? [];

  const zakupy: BondPurchase[] = [];
  for (const pos of positions) {
    const lista = pos.bond_purchases ?? [];
    const kupione = lista.reduce((s, p) => s + p.quantity, 0);
    if (kupione <= 0 || pos.quantity <= 0) continue;
    // Część serii umorzona/sprzedana — portfel skaluje wycenę proporcjonalnie,
    // robimy to samo per zakup, żeby suma zgadzała się z portfelem.
    const ratio = Math.min(1, pos.quantity / kupione);
    for (const p of lista) {
      if (p.exit_net_value === undefined || p.paid_coupons === undefined || p.net_value === undefined) {
        throw new Error('portfel nie zwraca net_value/exit_net_value/paid_coupons — wdróż nowszą wersję portfela');
      }
      zakupy.push({
        ticker: pos.ticker,
        date: p.date.slice(0, 10),
        quantity: p.quantity * ratio,
        exitNetValue: p.exit_net_value * ratio,
        netValue: p.net_value * ratio,
        paidCouponsNet: p.paid_coupons * (1 - BELKA) * ratio,
        partlyRedeemed: ratio < 1,
      });
    }
  }
  return zakupy.sort((a, b) => a.date.localeCompare(b.date));
}
