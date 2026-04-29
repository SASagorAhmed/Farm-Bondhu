import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { getOrSetCachedValue, invalidateByPrefix, makeCacheKey } from "../../services/responseCache.js";

const router = Router();

const chain = [requireDatabase, requireUser];
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
const DASHBOARD_CACHE_PREFIX = "dashboard";

router.use((req, res, next) => {
  if (req.method === "GET") return next();
  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.userId) return;
    invalidateByPrefix(`${DASHBOARD_CACHE_PREFIX}|u:${req.userId}|`);
  });
  next();
});

function pick(body, keys) {
  const o = {};
  for (const k of keys) {
    if (body[k] !== undefined) o[k] = body[k];
  }
  return o;
}

function isoDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function readLimit(req, fallback = 100, max = 300) {
  return Math.min(Math.max(Number(req.query.limit) || fallback, 1), max);
}

router.get(
  "/overview-bundle",
  ...chain,
  asyncHandler(async (req, res) => {
    const startedAt = nowMs();
    const uid = req.userId;
    const limit = readLimit(req, 10, 30);
    const cacheKey = makeCacheKey(DASHBOARD_CACHE_PREFIX, { userId: uid, parts: ["overview-bundle", limit] });
    const { value: payload, cacheHit } = await getOrSetCachedValue(cacheKey, 12_000, async () => {
      const [animalsRows, productionRows, financialRows, healthRows, salesRows, mortalityRows] =
        await Promise.all([
          sql`select count(*)::int as count from animals where user_id = ${uid}`,
          sql`
            select date, eggs, milk
            from production_records
            where user_id = ${uid}
            order by date asc
            limit ${limit}
          `,
          sql`
            select type, amount
            from financial_records
            where user_id = ${uid}
          `,
          sql`
            select id, date, description, animal_label
            from health_records
            where user_id = ${uid}
            order by date desc
            limit 2
          `,
          sql`
            select id, date, product, buyer, total
            from sale_records
            where user_id = ${uid}
            order by date desc
            limit 2
          `,
          sql`
            select id, date, count, animal_type, cause
            from mortality_records
            where user_id = ${uid}
            order by date desc
            limit 2
          `,
        ]);

      const records = financialRows || [];
      const totalRevenue = records
        .filter((r) => r.type === "income")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const totalExpenses = records
        .filter((r) => r.type === "expense")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

      const productionData = (productionRows || []).map((r) => ({
        date: isoDate(r.date),
        eggs: Number(r.eggs || 0),
        milk: Number(r.milk || 0),
      }));

      const recentActivity = [];
      for (const row of healthRows || []) {
        recentActivity.push({
          id: `h-${row.id}`,
          iconKey: "health",
          text: `${row.description} — ${row.animal_label || "Animal"}`,
          date: isoDate(row.date),
          link: "/dashboard/health",
        });
      }
      for (const row of salesRows || []) {
        recentActivity.push({
          id: `s-${row.id}`,
          iconKey: "sales",
          text: `${row.product} sold to ${row.buyer} — ৳${Number(row.total || 0).toLocaleString()}`,
          date: isoDate(row.date),
          link: "/dashboard/sales",
        });
      }
      for (const row of mortalityRows || []) {
        recentActivity.push({
          id: `m-${row.id}`,
          iconKey: "mortality",
          text: `${row.count} ${row.animal_type} deaths — ${row.cause}`,
          date: isoDate(row.date),
          link: "/dashboard/mortality",
        });
      }

      return {
        totalAnimals: animalsRows?.[0]?.count || 0,
        productionData,
        financials: {
          totalRevenue,
          totalExpenses,
          profit: totalRevenue - totalExpenses,
        },
        recentActivity: recentActivity
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 5),
      };
    });

    payload.metrics = {
      generated_in_ms: Math.max(0, nowMs() - startedAt),
      cache_hit: cacheHit,
    };
    res.setHeader("x-fb-dashboard-bundle-ms", String(payload.metrics.generated_in_ms));
    res.setHeader("Cache-Control", "private, max-age=10");
    res.setHeader("x-fb-cache", cacheHit ? "hit" : "miss");
    res.json({ data: payload });
  })
);

/** production_records */
router.get(
  "/production-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const limit = readLimit(req, 180, 365);
    const rows = await sql`
      select id, user_id, date, eggs, milk, created_at, updated_at
      from production_records
      where user_id = ${req.userId}
      order by date asc
      limit ${limit}
    `;
    res.json({ data: rows });
  })
);
router.post(
  "/production-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const row = pick(b, ["date", "eggs", "milk"]);
    if (!row.date) {
      res.status(400).json({ error: "date is required" });
      return;
    }
    const [created] = await sql`
      insert into production_records ${sql({ ...row, user_id: req.userId })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);
router.patch(
  "/production-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const patch = pick(req.body || {}, ["date", "eggs", "milk"]);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [updated] = await sql`
      update production_records set ${sql(patch)}
      where id = ${req.params.id} and user_id = ${req.userId}
      returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  })
);
router.delete(
  "/production-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      delete from production_records where id = ${req.params.id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

/** financial_records */
router.get(
  "/financial-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const limit = readLimit(req, 180, 365);
    const rows = await sql`
      select id, user_id, date, type, category, amount, description, created_at, updated_at
      from financial_records
      where user_id = ${req.userId}
      order by date desc
      limit ${limit}
    `;
    res.json({ data: rows });
  })
);
router.post(
  "/financial-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const row = pick(b, ["date", "type", "category", "amount", "description"]);
    if (!row.date || !row.type || row.amount === undefined) {
      res.status(400).json({ error: "date, type, and amount are required" });
      return;
    }
    const [created] = await sql`
      insert into financial_records ${sql({ ...row, user_id: req.userId })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);
router.patch(
  "/financial-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const patch = pick(req.body || {}, ["date", "type", "category", "amount", "description"]);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [updated] = await sql`
      update financial_records set ${sql(patch)}
      where id = ${req.params.id} and user_id = ${req.userId}
      returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  })
);
router.delete(
  "/financial-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      delete from financial_records where id = ${req.params.id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

/** mortality_records */
router.get(
  "/mortality-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const limit = readLimit(req, 180, 365);
    const rows = await sql`
      select id, user_id, farm_id, date, cause, animal_type, batch_id, count, created_at, updated_at
      from mortality_records
      where user_id = ${req.userId}
      order by date desc
      limit ${limit}
    `;
    res.json({ data: rows });
  })
);
router.post(
  "/mortality-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const row = pick(b, ["farm_id", "date", "cause", "animal_type", "batch_id", "count"]);
    if (!row.date || !row.cause || !row.animal_type || row.count === undefined) {
      res.status(400).json({ error: "date, cause, animal_type, and count are required" });
      return;
    }
    const [created] = await sql`
      insert into mortality_records ${sql({ ...row, user_id: req.userId })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);
router.patch(
  "/mortality-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const patch = pick(req.body || {}, ["farm_id", "date", "cause", "animal_type", "batch_id", "count"]);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [updated] = await sql`
      update mortality_records set ${sql(patch)}
      where id = ${req.params.id} and user_id = ${req.userId}
      returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  })
);
router.delete(
  "/mortality-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      delete from mortality_records where id = ${req.params.id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

/** feed_records */
router.get(
  "/feed-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const limit = readLimit(req, 180, 365);
    const rows = await sql`
      select id, user_id, farm_id, animal_id, animal_label, date, feed_type, quantity, unit, cost, created_at, updated_at
      from feed_records
      where user_id = ${req.userId}
      order by date desc
      limit ${limit}
    `;
    res.json({ data: rows });
  })
);
router.post(
  "/feed-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const row = pick(b, [
      "animal_id",
      "animal_label",
      "date",
      "feed_type",
      "quantity",
      "unit",
      "cost",
      "farm_id",
    ]);
    if (!row.date || !row.feed_type) {
      res.status(400).json({ error: "date and feed_type are required" });
      return;
    }
    const [created] = await sql`
      insert into feed_records ${sql({ ...row, user_id: req.userId })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);
router.patch(
  "/feed-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const patch = pick(req.body || {}, [
      "animal_id",
      "animal_label",
      "date",
      "feed_type",
      "quantity",
      "unit",
      "cost",
      "farm_id",
    ]);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [updated] = await sql`
      update feed_records set ${sql(patch)}
      where id = ${req.params.id} and user_id = ${req.userId}
      returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  })
);
router.delete(
  "/feed-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      delete from feed_records where id = ${req.params.id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

/** feed_inventory (read + upsert-style insert/update) */
router.get(
  "/feed-inventory",
  ...chain,
  asyncHandler(async (req, res) => {
    const limit = readLimit(req, 100, 300);
    const rows = await sql`
      select id, user_id, name, category, stock, reorder_level, unit, created_at, updated_at
      from feed_inventory
      where user_id = ${req.userId}
      order by created_at asc
      limit ${limit}
    `;
    res.json({ data: rows });
  })
);
router.post(
  "/feed-inventory",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const row = pick(b, ["name", "category", "stock", "reorder_level", "unit"]);
    if (!row.name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [created] = await sql`
      insert into feed_inventory ${sql({ ...row, user_id: req.userId })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);
router.patch(
  "/feed-inventory/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const patch = pick(req.body || {}, ["name", "category", "stock", "reorder_level", "unit"]);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [updated] = await sql`
      update feed_inventory set ${sql(patch)}
      where id = ${req.params.id} and user_id = ${req.userId}
      returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  })
);
router.delete(
  "/feed-inventory/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      delete from feed_inventory where id = ${req.params.id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

/** health_records */
router.get(
  "/health-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const limit = readLimit(req, 180, 365);
    const rows = await sql`
      select id, user_id, animal_id, animal_label, date, type, description, vet_name, cost, created_at, updated_at
      from health_records
      where user_id = ${req.userId}
      order by date desc
      limit ${limit}
    `;
    res.json({ data: rows });
  })
);
router.post(
  "/health-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const row = pick(b, [
      "animal_id",
      "animal_label",
      "date",
      "type",
      "description",
      "vet_name",
      "cost",
    ]);
    if (!row.date || !row.type) {
      res.status(400).json({ error: "date and type are required" });
      return;
    }
    const [created] = await sql`
      insert into health_records ${sql({ ...row, user_id: req.userId })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);
router.patch(
  "/health-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const patch = pick(req.body || {}, [
      "animal_id",
      "animal_label",
      "date",
      "type",
      "description",
      "vet_name",
      "cost",
    ]);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [updated] = await sql`
      update health_records set ${sql(patch)}
      where id = ${req.params.id} and user_id = ${req.userId}
      returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  })
);
router.delete(
  "/health-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      delete from health_records where id = ${req.params.id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

/** sale_records */
router.get(
  "/sale-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const limit = readLimit(req, 180, 365);
    const rows = await sql`
      select id, user_id, date, product, category, buyer, quantity, unit, unit_price, total, created_at, updated_at
      from sale_records
      where user_id = ${req.userId}
      order by date desc
      limit ${limit}
    `;
    res.json({ data: rows });
  })
);
router.post(
  "/sale-records",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const row = pick(b, ["date", "product", "category", "buyer", "quantity", "unit", "unit_price", "total"]);
    if (!row.date || !row.product || row.total === undefined) {
      res.status(400).json({ error: "date, product, and total are required" });
      return;
    }
    const [created] = await sql`
      insert into sale_records ${sql({ ...row, user_id: req.userId })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);
router.patch(
  "/sale-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const patch = pick(req.body || {}, [
      "date",
      "product",
      "category",
      "buyer",
      "quantity",
      "unit",
      "unit_price",
      "total",
    ]);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [updated] = await sql`
      update sale_records set ${sql(patch)}
      where id = ${req.params.id} and user_id = ${req.userId}
      returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  })
);
router.delete(
  "/sale-records/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      delete from sale_records where id = ${req.params.id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

export default router;
