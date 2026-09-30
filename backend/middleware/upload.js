import multer from 'multer';
import { getConfig } from '../config/env.js';

export function uploadSingle() {
  return (req, res, next) => {
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: getConfig().maxUploadBytes, files: 1 },
    }).single('file');

    upload(req, res, (error) => {
      if (error) next(error);
      else next();
    });
  };
}
