import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const validStatuses = new Set(["draft", "running", "completed"]);

function validExperimentInput(body) {
  if (
    typeof body.title !== "string" || !body.title.trim()
    || typeof body.hypothesis !== "string" || !body.hypothesis.trim()
  ) {
    return false;
  }

  return body.variants === undefined || (
    Array.isArray(body.variants)
    && body.variants.length >= 2
    && body.variants.every((variant) =>
      typeof variant.name === "string" && variant.name.trim()
      && typeof variant.content === "string" && variant.content.trim()
    )
  );
}

function variantCreateData(variants = []) {
  const definitions = variants.length
    ? variants
    : [
        { name: "Control", content: "Original version", isDefault: true },
        { name: "Variant B", content: "Alternative version", isDefault: false },
      ];
  const defaultIndex = Math.max(0, definitions.findIndex((variant) => variant.isDefault));

  return definitions.map((variant, index) => ({
    name: variant.name.trim(),
    content: variant.content.trim(),
    isDefault: index === defaultIndex,
  }));
}

async function getOwnedExperiment(id, userId) {
  return prisma.experiment.findFirst({ where: { id, userId } });
}

async function includeEventStats(experiments) {
  const variantIds = experiments.flatMap((experiment) =>
    experiment.variants.map((variant) => variant.id)
  );
  const counts = variantIds.length
    ? await prisma.eventLog.groupBy({
        by: ["variantId", "eventType"],
        where: { variantId: { in: variantIds } },
        _count: { _all: true },
      })
    : [];
  const countByVariant = new Map();
  for (const count of counts) {
    const stats = countByVariant.get(count.variantId) ?? { impressions: 0, conversions: 0 };
    stats[count.eventType === "impression" ? "impressions" : "conversions"] = count._count._all;
    countByVariant.set(count.variantId, stats);
  }

  return experiments.map((experiment) => ({
    ...experiment,
    variants: experiment.variants.map((variant) => {
      const stats = countByVariant.get(variant.id) ?? { impressions: 0, conversions: 0 };
      return {
        ...variant,
        ...stats,
        conversionRate: stats.impressions ? stats.conversions / stats.impressions : 0,
      };
    }),
  }));
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const experiments = await prisma.experiment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: { variants: { orderBy: { createdAt: "asc" } } },
    });
    return res.json({ experiments: await includeEventStats(experiments) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  if (!validExperimentInput(req.body)) {
    return res.status(400).json({ error: "Title, hypothesis, and valid variants are required." });
  }
  if (req.body.status !== undefined && !validStatuses.has(req.body.status)) {
    return res.status(400).json({ error: "Status must be draft, running, or completed." });
  }

  try {
    const experiment = await prisma.experiment.create({
      data: {
        userId: req.user.id,
        title: req.body.title.trim(),
        hypothesis: req.body.hypothesis.trim(),
        status: req.body.status ?? "draft",
        variants: { create: variantCreateData(req.body.variants) },
      },
      include: { variants: true },
    });
    return res.status(201).json({ experiment });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const experiment = await prisma.experiment.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { variants: { orderBy: { createdAt: "asc" } } },
    });
    if (!experiment) return res.status(404).json({ error: "Experiment not found." });
    return res.json({ experiment: (await includeEventStats([experiment]))[0] });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  const updates = {};
  if (req.body.title !== undefined) {
    if (typeof req.body.title !== "string" || !req.body.title.trim()) {
      return res.status(400).json({ error: "Title must not be empty." });
    }
    updates.title = req.body.title.trim();
  }
  if (req.body.hypothesis !== undefined) {
    if (typeof req.body.hypothesis !== "string" || !req.body.hypothesis.trim()) {
      return res.status(400).json({ error: "Hypothesis must not be empty." });
    }
    updates.hypothesis = req.body.hypothesis.trim();
  }
  if (req.body.status !== undefined) {
    if (!validStatuses.has(req.body.status)) {
      return res.status(400).json({ error: "Status must be draft, running, or completed." });
    }
    updates.status = req.body.status;
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: "Provide at least one field to update." });
  }

  try {
    const existing = await getOwnedExperiment(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: "Experiment not found." });
    const experiment = await prisma.experiment.update({
      where: { id: existing.id },
      data: updates,
      include: { variants: true },
    });
    return res.json({ experiment });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await getOwnedExperiment(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: "Experiment not found." });
    await prisma.experiment.delete({ where: { id: existing.id } });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/conclude", async (req, res, next) => {
  const { variantId } = req.body;
  if (typeof variantId !== "string" || !variantId) {
    return res.status(400).json({ error: "A winning variantId is required." });
  }

  try {
    const experiment = await getOwnedExperiment(req.params.id, req.user.id);
    if (!experiment) return res.status(404).json({ error: "Experiment not found." });

    const winner = await prisma.variant.findFirst({
      where: { id: variantId, experimentId: experiment.id },
    });
    if (!winner) return res.status(400).json({ error: "The variant does not belong to this experiment." });

    const promotedVariant = await prisma.$transaction(async (transaction) => {
      await transaction.variant.updateMany({
        where: { experimentId: experiment.id },
        data: { isDefault: false },
      });
      const promoted = await transaction.variant.update({
        where: { id: winner.id },
        data: { isDefault: true },
      });
      await transaction.experiment.update({
        where: { id: experiment.id },
        data: { status: "completed" },
      });
      return promoted;
    });

    return res.json({ variant: promotedVariant, status: "completed" });
  } catch (error) {
    return next(error);
  }
});

export default router;
