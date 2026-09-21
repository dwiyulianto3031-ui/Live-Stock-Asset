import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements, users } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/products/[id]/detail - Detail produk dengan SN/Barcode breakdown
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getSession(); // opsional: guest boleh lihat
    const { id } = await params;
    const productId = Number(id);
    if (!productId) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const productRows = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (productRows.length === 0) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }
    const product = productRows[0];

    // Ambil semua movements untuk produk ini
    const movements = await db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        source: stockMovements.source,
        quantity: stockMovements.quantity,
        serialNumber: stockMovements.serialNumber,
        barcode: stockMovements.barcode,
        assetStatus: stockMovements.assetStatus,
        ticketNo: stockMovements.ticketNo,
        storeName: stockMovements.storeName,
        note: stockMovements.note,
        createdAt: stockMovements.createdAt,
        userName: users.fullName,
      })
      .from(stockMovements)
      .innerJoin(users, eq(stockMovements.userId, users.id))
      .where(eq(stockMovements.productId, productId))
      .orderBy(desc(stockMovements.createdAt));

    // ===== Bangun set SN & Barcode yang SUDAH KELUAR =====
    const outSNSet = new Set<string>();
    const outBarcodeSet = new Set<string>();
    const outgoingItems: SerialItem[] = [];

    for (const m of movements) {
      if (m.type !== "out") continue;
      let serialNumbers: string[] = [];
      let barcodes: string[] = [];
      try {
        if (m.serialNumber) {
          const parsed = JSON.parse(m.serialNumber);
          serialNumbers = Array.isArray(parsed) ? parsed : [m.serialNumber];
        }
      } catch {
        serialNumbers = m.serialNumber ? [m.serialNumber] : [];
      }
      try {
        if (m.barcode) {
          const parsed = JSON.parse(m.barcode);
          barcodes = Array.isArray(parsed) ? parsed : [m.barcode];
        }
      } catch {
        barcodes = m.barcode ? [m.barcode] : [];
      }
      serialNumbers.forEach((sn) => outSNSet.add(sn));
      barcodes.forEach((bc) => outBarcodeSet.add(bc));

      const items: SerialItem[] = serialNumbers.map((sn, idx) => ({
        serialNumber: sn,
        barcode: barcodes[idx] ?? null,
        assetStatus: m.assetStatus,
        movementId: m.id,
        ticketNo: m.ticketNo,
        storeName: m.storeName,
        userName: m.userName,
        createdAt: m.createdAt,
      }));
      if (serialNumbers.length === 0 && barcodes.length > 0) {
        items.push(
          ...barcodes.map((bc) => ({
            serialNumber: "-",
            barcode: bc,
            assetStatus: m.assetStatus,
            movementId: m.id,
            ticketNo: m.ticketNo,
            storeName: m.storeName,
            userName: m.userName,
            createdAt: m.createdAt,
          })),
        );
      }
      outgoingItems.push(...items);
    }

    // ===== Klasifikasi items masuk (baru/retur) dengan filter sudah keluar =====
    type SerialItem = {
      serialNumber: string;
      barcode: string | null;
      assetStatus: string | null;
      movementId: number;
      ticketNo: string | null;
      storeName: string | null;
      userName: string;
      createdAt: Date;
    };

    const newItems: SerialItem[] = [];
    const returnItems: SerialItem[] = [];

    for (const m of movements) {
      if (m.type !== "in") continue;
      let serialNumbers: string[] = [];
      let barcodes: string[] = [];
      try {
        if (m.serialNumber) {
          const parsed = JSON.parse(m.serialNumber);
          serialNumbers = Array.isArray(parsed) ? parsed : [m.serialNumber];
        }
      } catch {
        serialNumbers = m.serialNumber ? [m.serialNumber] : [];
      }
      try {
        if (m.barcode) {
          const parsed = JSON.parse(m.barcode);
          barcodes = Array.isArray(parsed) ? parsed : [m.barcode];
        }
      } catch {
        barcodes = m.barcode ? [m.barcode] : [];
      }

      // Filter: hanya SN/Barcode yang BELUM keluar
      const filteredSNs: string[] = [];
      const filteredBCs: string[] = [];
      for (let i = 0; i < Math.max(serialNumbers.length, barcodes.length); i++) {
        const sn = serialNumbers[i] ?? null;
        const bc = barcodes[i] ?? null;
        if (sn && outSNSet.has(sn)) continue; // SN sudah keluar -> skip
        if (bc && outBarcodeSet.has(bc)) continue; // Barcode sudah keluar -> skip
        filteredSNs.push(sn ?? "-");
        filteredBCs.push(bc ?? "");
      }

      const items: SerialItem[] = filteredSNs.map((sn, idx) => ({
        serialNumber: sn,
        barcode: filteredBCs[idx] || null,
        assetStatus: m.assetStatus,
        movementId: m.id,
        ticketNo: m.ticketNo,
        storeName: m.storeName,
        userName: m.userName,
        createdAt: m.createdAt,
      }));

      if (m.source === "new") newItems.push(...items);
      else returnItems.push(...items);
    }

    return NextResponse.json({
      product: {
        ...product,
        totalStock: product.newStock + product.returnStock,
      },
      serialBreakdown: {
        new: newItems,
        return: returnItems,
        outgoing: outgoingItems,
      },
      movements,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal memuat detail produk" },
      { status: 500 },
    );
  }
}
