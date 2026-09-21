import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  varchar,
  uniqueIndex,
  index,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 50 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("pic"), // admin | pic
    email: varchar("email", { length: 150 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_username_unique").on(table.username),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: varchar("user_name", { length: 150 }),
    action: varchar("action", { length: 50 }).notNull(), // CREATE, UPDATE, DELETE, LOGIN, EXPORT, IMPORT, ADJUST
    entityType: varchar("entity_type", { length: 50 }).notNull(), // user, product, movement
    entityId: integer("entity_id"),
    description: text("description"),
    metadata: text("metadata"), // JSON
    ipAddress: varchar("ip_address", { length: 50 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("audit_logs_user_idx").on(table.userId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    createdIdx: index("audit_logs_created_idx").on(table.createdAt),
  }),
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: varchar("sku", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 100 }).notNull().default("Umum"),
    unit: varchar("unit", { length: 20 }).notNull().default("pcs"),
    brand: varchar("brand", { length: 100 }), // merk
    model: varchar("model", { length: 150 }), // tipe/varian
    minStock: integer("min_stock").notNull().default(10),
    // Stok terbagi menjadi 2: Baru dan Retur
    newStock: integer("new_stock").notNull().default(0),
    returnStock: integer("return_stock").notNull().default(0),
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at"),
    archivedBy: varchar("archived_by", { length: 150 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    skuUnique: uniqueIndex("products_sku_unique").on(table.sku),
    categoryIdx: index("products_category_idx").on(table.category),
  }),
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 10 }).notNull(), // 'in' | 'out'
    source: varchar("source", { length: 10 }).notNull().default("new"), // 'new' | 'return' - sumber/kategori stok
    quantity: integer("quantity").notNull(),
    ticketNo: varchar("ticket_no", { length: 50 }),
    storeName: varchar("store_name", { length: 150 }),
    serialNumber: varchar("serial_number", { length: 150 }),
    barcode: varchar("barcode", { length: 150 }),
    assetStatus: varchar("asset_status", { length: 50 }),
    itemType: varchar("item_type", { length: 100 }), // tipe barang (opsional)
    resi: text("resi"), // JSON array nomor resi pengiriman
    driveLink: text("drive_link"), // link google drive bukti serah terima
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    productIdx: index("stock_movements_product_idx").on(table.productId),
    userIdx: index("stock_movements_user_idx").on(table.userId),
    createdIdx: index("stock_movements_created_idx").on(table.createdAt),
    snIdx: index("stock_movements_sn_idx").on(table.serialNumber),
    barcodeIdx: index("stock_movements_barcode_idx").on(table.barcode),
  }),
);

// ===== 2. STOCK OPNAME =====
export const stockOpnames = pgTable(
  "stock_opnames",
  {
    id: serial("id").primaryKey(),
    periode: varchar("periode", { length: 20 }).notNull(),
    opnameDate: timestamp("opname_date").notNull().defaultNow(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    userName: varchar("user_name", { length: 150 }),
    status: varchar("status", { length: 20 }).notNull().default("open"), // open | adjusted | closed
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    periodeIdx: index("idx_opname_periode").on(table.periode),
  }),
);

export const stockOpnameItems = pgTable(
  "stock_opname_items",
  {
    id: serial("id").primaryKey(),
    opnameId: integer("opname_id")
      .notNull()
      .references(() => stockOpnames.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    productSku: varchar("product_sku", { length: 50 }),
    productName: varchar("product_name", { length: 200 }),
    systemNew: integer("system_new").notNull().default(0),
    systemReturn: integer("system_return").notNull().default(0),
    countedNew: integer("counted_new").notNull().default(0),
    countedReturn: integer("counted_return").notNull().default(0),
    diffNew: integer("diff_new").notNull().default(0),
    diffReturn: integer("diff_return").notNull().default(0),
    adjusted: boolean("adjusted").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    opnameIdx: index("idx_opname_items_opname").on(table.opnameId),
  }),
);

// ===== 5. NOTIFIKASI STOK MENIPIS =====
export const stockAlerts = pgTable(
  "stock_alerts",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    productSku: varchar("product_sku", { length: 50 }),
    productName: varchar("product_name", { length: 200 }),
    currentTotal: integer("current_total").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    recipient: varchar("recipient", { length: 150 }),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
    status: varchar("status", { length: 20 }).notNull().default("sent"), // sent | failed | pending
  },
  (table) => ({
    productIdx: index("idx_alerts_product").on(table.productId),
    sentIdx: index("idx_alerts_sent").on(table.sentAt),
  }),
);

// ===== 6. RIWAYAT STATUS ASSET =====
export const assetStatusHistory = pgTable(
  "asset_status_history",
  {
    id: serial("id").primaryKey(),
    movementId: integer("movement_id").references(() => stockMovements.id, {
      onDelete: "cascade",
    }),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    serialNumber: varchar("serial_number", { length: 150 }),
    barcode: varchar("barcode", { length: 150 }),
    oldStatus: varchar("old_status", { length: 50 }),
    newStatus: varchar("new_status", { length: 50 }),
    changedBy: varchar("changed_by", { length: 150 }),
    changedAt: timestamp("changed_at").notNull().defaultNow(),
  },
  (table) => ({
    snIdx: index("idx_asset_history_sn").on(table.serialNumber),
    productIdx: index("idx_asset_history_product").on(table.productId),
  }),
);
