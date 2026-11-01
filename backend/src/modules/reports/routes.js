const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, query, param } = require('express-validator');
const { asyncHandler, ok, ApiError } = require('../../common/errors');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const service = require('./service');

const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Production uploads: Cloudinary when configured (Render disk is ephemeral),
// plain disk otherwise (local dev). Stored imageUrl works for both shapes.
function buildStorage() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });
    const { CloudinaryStorage } = require('multer-storage-cloudinary');
    return new CloudinaryStorage({
      cloudinary,
      params: { folder: 'hazard-rage', allowed_formats: ['jpg', 'png', 'webp'] },
    });
  }
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  });
}
function storedUrl(file) {
  if (!file) return null;
  if (file.path && file.path.startsWith('http')) return file.path; // Cloudinary
  return `/uploads/${file.filename}`; // local disk
}
const upload = multer({
  storage: buildStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
    return cb(new ApiError('VALIDATION_ERROR', 'image: only jpg/png/webp allowed', 400));
  },
});

const router = express.Router();

router.post('/', authenticate, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new ApiError('VALIDATION_ERROR', 'image: max 5MB', 400));
      return next(err.status ? err : new ApiError('VALIDATION_ERROR', err.message, 400));
    }
    return next();
  });
},
  [body('zone_id').optional().isInt({ min: 1 }).withMessage('zone_id int required'),
   body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('lat -90..90 required'),
   body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng -180..180 required'),
   body('waste_type').isIn(['organic', 'plastic', 'construction', 'biomedical', 'mixed']).withMessage('invalid waste_type'),
   body('severity').isIn(['Low', 'Med', 'High']).withMessage('invalid severity'),
   body('description').optional().isLength({ max: 2000 }).withMessage('max 2000 chars')],
  validate,
  asyncHandler(async (req, res) => {
    const imagePath = req.file && !String(req.file.path || '').startsWith('http') ? path.join(uploadDir, req.file.filename) : null;
    try {
      const out = await service.createReport({
        userId: req.user.id,
        zoneId: req.body.zone_id !== undefined && req.body.zone_id !== '' ? parseInt(req.body.zone_id, 10) : null,
        wasteType: req.body.waste_type,
        severity: req.body.severity,
        description: req.body.description,
        imageUrl: req.file ? storedUrl(req.file) : (req.body.image_url || null),
        lat: req.body.lat !== undefined && req.body.lat !== '' ? Number(req.body.lat) : undefined,
        lng: req.body.lng !== undefined && req.body.lng !== '' ? Number(req.body.lng) : undefined,
      });
      return ok(res, out, 201);
    } catch (err) {
      if (imagePath) fs.promises.unlink(imagePath).catch(() => {});
      throw err;
    }
  }));

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const out = await service.listReports(req.query, req.user);
  return ok(res, out.items, 200);
}));

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const r = await service.getReport(parseInt(req.params.id, 10), req.user);
  return ok(res, r);
}));

router.patch('/:id/status', authenticate, authorize('municipal_admin', 'system_admin'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new ApiError('VALIDATION_ERROR', 'image: max 5MB', 400));
      return next(err.status ? err : new ApiError('VALIDATION_ERROR', err.message, 400));
    }
    return next();
  });
},
  [body('status').isIn(['Pending', 'In Progress', 'Resolved']).withMessage('invalid status')],
  validate,
  asyncHandler(async (req, res) => {
    const imagePath = req.file && !String(req.file.path || '').startsWith('http') ? path.join(uploadDir, req.file.filename) : null;
    try {
      const out = await service.updateStatus(parseInt(req.params.id, 10), req.body.status, {
        resolvedImageUrl: req.file ? storedUrl(req.file) : undefined,
      });
      return ok(res, out);
    } catch (err) {
      if (imagePath) fs.promises.unlink(imagePath).catch(() => {});
      throw err;
    }
  }));

module.exports = router;
