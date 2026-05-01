import type { RequestHandler } from "express";
import {
  archiveAdminPlace,
  createAdminPlace,
  getAdminPlaceById,
  getAdminPlaces,
  updateAdminPlace,
} from "../services/place.service";
import { getGoogleMapsImportCandidates, importGoogleMapsCandidate } from "../services/google-maps-import.service";
import { createImageUploadResponse } from "../services/upload.service";
import type { AdminPlace } from "../types/domain";
import { HttpError } from "../utils/http-error";

export const listAdminPlaces: RequestHandler = async (req, res) => {
  res.json(await getAdminPlaces(req.query));
};

export const getAdminPlace: RequestHandler = async (req, res) => {
  res.json(await getAdminPlaceById(String(req.params.id)));
};

export const createPlace: RequestHandler = async (req, res) => {
  res.status(201).json(await createAdminPlace(req.body as Partial<AdminPlace>));
};

export const listGoogleMapsCandidates: RequestHandler = async (_req, res) => {
  res.json(await getGoogleMapsImportCandidates());
};

export const importGoogleMapsPlace: RequestHandler = async (req, res) => {
  const result = await importGoogleMapsCandidate(req.body as { mapsUrl?: string; name?: string });

  res.status(result.created ? 201 : 200).json(result);
};

export const updatePlace: RequestHandler = async (req, res) => {
  res.json(await updateAdminPlace(String(req.params.id), req.body as Partial<AdminPlace>));
};

export const archivePlace: RequestHandler = async (req, res) => {
  res.json(await archiveAdminPlace(String(req.params.id)));
};

export const uploadPlaceImage: RequestHandler = async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, "Image file is required");
  }

  res.json(await createImageUploadResponse(req));
};
