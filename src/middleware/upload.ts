import multer from "multer";
import { paths } from "../config/paths";

export const imageUpload = multer({
  dest: paths.uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }

    cb(null, true);
  },
});
