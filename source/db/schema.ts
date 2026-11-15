import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("chess_rooms", {
  id: text("id").primaryKey(),
  whiteHash: text("white_hash").notNull(),
  blackHash: text("black_hash"),
  moves: text("moves").notNull().default("[]"),
  revision: integer("revision").notNull().default(0),
  result: text("result"),
  reason: text("reason"),
  drawOffer: text("draw_offer"),
  requests: text("requests").notNull().default("[]"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, table => [index("chess_rooms_expiry").on(table.expiresAt)]);
