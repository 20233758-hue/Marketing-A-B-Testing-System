import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();
const eventTypes = new Set(["impression", "conversion"]);

router.post("/", async (req, res, next) => {
  const { variantId, eventType } = req.body;
  if (typeof variantId !== "string" || !variantId || !eventTypes.has(eventType)) {
    return res.status(400).json({
      error: "A variantId and eventType of impression or conversion are required.",
    });
  }

  try {
    const variant = await prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant) return res.status(404).json({ error: "Variant not found." });

    await prisma.eventLog.create({ data: { variantId, eventType } });

    const counts = await prisma.eventLog.groupBy({
      by: ["eventType"],
      where: { variantId },
      _count: { _all: true },
    });
    const impressions = counts.find((item) => item.eventType === "impression")?._count._all ?? 0;
    const conversions = counts.find((item) => item.eventType === "conversion")?._count._all ?? 0;

    return res.status(201).json({
      success: true,
      stats: {
        impressions,
        conversions,
        conversionRate: impressions ? conversions / impressions : 0,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
