import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { detectImageType, detectReceiptFileType } from '../services/storage.service.js';

const storage = multer.memoryStorage();

// Max 5 MB for standard media
export const uploadMemory5MB = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

// Max 2 MB for avatar
export const uploadMemory2MB = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
    files: 1,
  },
});

export function handleSingleUpload(uploader) {
  return (req, res, next) => {
    uploader.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the maximum allowed size'));
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new AppError(400, 'INVALID_FILE_FIELD', 'Unexpected field name. Use "file" for upload.'));
          }
          return next(new AppError(400, 'INVALID_FILE_UPLOAD', err.message));
        }
        return next(err);
      }

      if (!req.file) {
        return next(AppError.badRequest('No file uploaded. Please provide a file in the "file" field.'));
      }

      // Validate real magic bytes
      const detected = detectImageType(req.file.buffer);
      if (!detected) {
        return next(
          new AppError(
            400,
            'INVALID_FILE_TYPE',
            'Only image files (JPEG, PNG, WebP) are allowed. SVG and other file types are rejected.'
          )
        );
      }

      // Attach detected type info to request for controller usage
      req.detectedFile = detected;
      next();
    });
  };
}

export function handleOptionalUpload(uploader) {
  return (req, res, next) => {
    uploader.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the maximum allowed size'));
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new AppError(400, 'INVALID_FILE_FIELD', 'Unexpected field name. Use "file" for upload.'));
          }
          return next(new AppError(400, 'INVALID_FILE_UPLOAD', err.message));
        }
        return next(err);
      }

      if (!req.file) {
        return next();
      }

      // Validate real magic bytes
      const detected = detectImageType(req.file.buffer);
      if (!detected) {
        return next(
          new AppError(
            400,
            'INVALID_FILE_TYPE',
            'Only image files (JPEG, PNG, WebP) are allowed. SVG and other file types are rejected.'
          )
        );
      }

      req.detectedFile = detected;
      next();
    });
  };
}

export function handleReceiptUpload(uploader) {
  return (req, res, next) => {
    uploader.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the maximum allowed size'));
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new AppError(400, 'INVALID_FILE_FIELD', 'Unexpected field name. Use "file" for upload.'));
          }
          return next(new AppError(400, 'INVALID_FILE_UPLOAD', err.message));
        }
        return next(err);
      }

      if (!req.file) {
        return next(AppError.badRequest('No file uploaded. Please provide a file in the "file" field.'));
      }

      // Validate real magic bytes for receipts (JPEG, PNG, WebP, PDF)
      const detected = detectReceiptFileType(req.file.buffer);
      if (!detected) {
        return next(
          new AppError(
            400,
            'INVALID_FILE_TYPE',
            'Only JPEG, PNG, WebP, and PDF files are allowed. SVG and other file types are rejected.'
          )
        );
      }

      req.detectedFile = detected;
      next();
    });
  };
}
