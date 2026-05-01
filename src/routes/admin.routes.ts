import { Router } from "express";
import {
  archivePlace,
  createPlace,
  getAdminPlace,
  importGoogleMapsPlace,
  listAdminPlaces,
  listGoogleMapsCandidates,
  updatePlace,
  uploadPlaceImage,
} from "../controllers/admin-places.controller";
import { requireAuth } from "../middleware/auth";
import { imageUpload } from "../middleware/upload";

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.get("/places", listAdminPlaces);
adminRouter.get("/places/import/google-maps/candidates", listGoogleMapsCandidates);
adminRouter.post("/places/import/google-maps", importGoogleMapsPlace);
adminRouter.get("/places/:id", getAdminPlace);
adminRouter.post("/places", createPlace);
adminRouter.patch("/places/:id", updatePlace);
adminRouter.delete("/places/:id", archivePlace);
adminRouter.post("/uploads/images", imageUpload.single("file"), uploadPlaceImage);
