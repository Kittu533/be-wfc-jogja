import type { RequestHandler } from "express";
import { getCuratedListBySlug, getCuratedLists } from "../services/curated-list.service";
import { getCafeReviews, getPublicCafeBySlug, getPublicCafes } from "../services/place.service";

export const listCafes: RequestHandler = async (req, res) => {
  res.json(await getPublicCafes(req.query));
};

export const getCafeDetail: RequestHandler = async (req, res) => {
  res.json(await getPublicCafeBySlug(String(req.params.slug)));
};

export const listCafeReviews: RequestHandler = async (req, res) => {
  res.json(await getCafeReviews(String(req.params.id)));
};

export const listCuratedLists: RequestHandler = async (_req, res) => {
  res.json(await getCuratedLists());
};

export const getCuratedList: RequestHandler = async (req, res) => {
  res.json(await getCuratedListBySlug(String(req.params.slug), req.query));
};
