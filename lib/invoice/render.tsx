// Frozen contract (specs/SA-09-facture.md, C0): pure — no database, no
// "server-only" import needed. Takes already-fetched data (the caller reads
// `purchases` via lib/dal/account.ts's listPurchases, filtered to the
// requested month) and returns a rendered PDF buffer.
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { AccountPurchase } from "@/lib/dal/account";

export type InvoicePdfInput = {
  productName: string;
  buyerEmail: string;
  month: string; // "YYYY-MM"
  purchases: AccountPurchase[];
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 4 },
  subtitle: { fontSize: 11, marginBottom: 12, color: "#555555" },
  disclaimer: { fontSize: 9, color: "#888888", marginBottom: 16 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 4,
    marginBottom: 4,
  },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dddddd", paddingVertical: 4 },
  headerCell: { flex: 1, fontFamily: "Helvetica-Bold" },
  cell: { flex: 1 },
  empty: { marginTop: 12, color: "#555555" },
});

// French only, hardcoded (spec's Hors périmètre: no real VAT/legal
// mentions, a "demo" disclaimer is enough) — this is text baked into a
// generated document, not UI chrome subject to the messages/*.json split.
const DEMO_DISCLAIMER = "Document de démonstration — sans valeur légale ni fiscale (aucune mention de TVA).";

function formatAmount(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amountCents / 100);
  } catch {
    // An unknown/invalid currency code must never crash the render.
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function InvoiceDocument({ productName, buyerEmail, month, purchases }: InvoicePdfInput) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{productName}</Text>
        <Text style={styles.subtitle}>
          Facture pour {buyerEmail} — {month}
        </Text>
        <Text style={styles.disclaimer}>{DEMO_DISCLAIMER}</Text>

        {purchases.length === 0 ? (
          <Text style={styles.empty}>Aucun achat sur ce mois.</Text>
        ) : (
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.headerCell}>Date</Text>
              <Text style={styles.headerCell}>Crédits</Text>
              <Text style={styles.headerCell}>Montant</Text>
            </View>
            {purchases.map((purchase) => (
              <View style={styles.row} key={purchase.id}>
                <Text style={styles.cell}>{formatDate(purchase.createdAt)}</Text>
                <Text style={styles.cell}>{purchase.credits}</Text>
                <Text style={styles.cell}>{formatAmount(purchase.amountCents, purchase.currency)}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...input} />);
}
