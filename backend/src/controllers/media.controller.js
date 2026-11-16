import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { storageService } from '../services/storage.service.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { assertOwnsProperty, assertOwnsSpace } from '../utils/ownership.js';

export async function uploadPropertyMedia(req, res) {
  const { id: propertyId } = req.params;
  const file = req.file;
  const detected = req.detectedFile;
  const caption = req.body.caption || null;

  const property = await prisma.properties.findUnique({
    where: { id: propertyId },
    include: { _count: { select: { property_media: true } } },
  });

  if (!property) {
    throw AppError.notFound('Property not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsProperty(property, req.user.id);
  }

  // Maximum 10 images per property
  if (property._count.property_media >= 10) {
    throw AppError.conflict('Maximum 10 images allowed per property');
  }

  const existingCount = property._count.property_media;
  const isCover = existingCount === 0;
  const sortOrder = existingCount;
  const storagePath = `${property.owner_id}/${uuidv4()}.${detected.ext}`;
  const bucket = 'property-media';

  // Upload to Supabase Storage
  const publicUrl = await storageService.uploadPublicFile(bucket, storagePath, file.buffer, detected.mimeType);

  try {
    const [mediaItem] = await prisma.$transaction([
      prisma.property_media.create({
        data: {
          property_id: propertyId,
          url: publicUrl,
          storage_path: storagePath,
          media_type: 'IMAGE',
          caption,
          sort_order: sortOrder,
          is_cover: isCover,
        },
      }),
      prisma.media_assets.create({
        data: {
          owner_type: 'PROPERTY',
          owner_id: propertyId,
          bucket,
          storage_path: storagePath,
          mime_type: detected.mimeType,
          size_bytes: file.size,
          uploaded_by: req.user.id,
          sort_order: sortOrder,
        },
      }),
    ]);

    sendSuccess(res, mediaItem, 201);
  } catch (error) {
    // Clean up uploaded object if database transaction fails
    await storageService.deleteFile(bucket, storagePath);
    throw error;
  }
}

export async function uploadSpaceMedia(req, res) {
  const { id: spaceId } = req.params;
  const file = req.file;
  const detected = req.detectedFile;
  const caption = req.body.caption || null;

  const space = await prisma.spaces.findUnique({
    where: { id: spaceId },
    include: {
      properties: { select: { owner_id: true } },
      _count: { select: { space_media: true } },
    },
  });

  if (!space) {
    throw AppError.notFound('Space not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsSpace(space, req.user.id);
  }

  if (space._count.space_media >= 10) {
    throw AppError.conflict('Maximum 10 images allowed per space');
  }

  const existingCount = space._count.space_media;
  const isCover = existingCount === 0;
  const sortOrder = existingCount;
  const storagePath = `${space.properties.owner_id}/${uuidv4()}.${detected.ext}`;
  const bucket = 'space-media';

  const publicUrl = await storageService.uploadPublicFile(bucket, storagePath, file.buffer, detected.mimeType);

  try {
    const [mediaItem] = await prisma.$transaction([
      prisma.space_media.create({
        data: {
          space_id: spaceId,
          url: publicUrl,
          storage_path: storagePath,
          media_type: 'IMAGE',
          caption,
          sort_order: sortOrder,
          is_cover: isCover,
        },
      }),
      prisma.media_assets.create({
        data: {
          owner_type: 'SPACE',
          owner_id: spaceId,
          bucket,
          storage_path: storagePath,
          mime_type: detected.mimeType,
          size_bytes: file.size,
          uploaded_by: req.user.id,
          sort_order: sortOrder,
        },
      }),
    ]);

    sendSuccess(res, mediaItem, 201);
  } catch (error) {
    await storageService.deleteFile(bucket, storagePath);
    throw error;
  }
}

export async function deletePropertyMedia(req, res) {
  const { id } = req.params;

  const media = await prisma.property_media.findUnique({
    where: { id },
    include: {
      properties: { select: { owner_id: true } },
    },
  });

  if (!media) {
    throw AppError.notFound('Media item not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsProperty(media.properties, req.user.id);
  }

  await prisma.$transaction(async (tx) => {
    await tx.property_media.delete({ where: { id } });

    if (media.storage_path) {
      await tx.media_assets.deleteMany({
        where: {
          bucket: 'property-media',
          storage_path: media.storage_path,
        },
      });
    }

    // If deleted image was cover, promote the next image by sort_order
    if (media.is_cover) {
      const nextMedia = await tx.property_media.findFirst({
        where: { property_id: media.property_id },
        orderBy: { sort_order: 'asc' },
      });
      if (nextMedia) {
        await tx.property_media.update({
          where: { id: nextMedia.id },
          data: { is_cover: true },
        });
      }
    }
  });

  if (media.storage_path) {
    await storageService.deleteFile('property-media', media.storage_path);
  }

  sendSuccess(res, { deleted: true });
}

export async function deleteSpaceMedia(req, res) {
  const { id } = req.params;

  const media = await prisma.space_media.findUnique({
    where: { id },
    include: {
      spaces: {
        include: {
          properties: { select: { owner_id: true } },
        },
      },
    },
  });

  if (!media) {
    throw AppError.notFound('Media item not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsSpace(media.spaces, req.user.id);
  }

  await prisma.$transaction(async (tx) => {
    await tx.space_media.delete({ where: { id } });

    if (media.storage_path) {
      await tx.media_assets.deleteMany({
        where: {
          bucket: 'space-media',
          storage_path: media.storage_path,
        },
      });
    }

    if (media.is_cover) {
      const nextMedia = await tx.space_media.findFirst({
        where: { space_id: media.space_id },
        orderBy: { sort_order: 'asc' },
      });
      if (nextMedia) {
        await tx.space_media.update({
          where: { id: nextMedia.id },
          data: { is_cover: true },
        });
      }
    }
  });

  if (media.storage_path) {
    await storageService.deleteFile('space-media', media.storage_path);
  }

  sendSuccess(res, { deleted: true });
}

export async function updatePropertyMedia(req, res) {
  const { id } = req.params;
  const input = req.body;

  const media = await prisma.property_media.findUnique({
    where: { id },
    include: {
      properties: { select: { owner_id: true } },
    },
  });

  if (!media) {
    throw AppError.notFound('Media item not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsProperty(media.properties, req.user.id);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isCover === true) {
      // Unset all other covers for this property
      await tx.property_media.updateMany({
        where: { property_id: media.property_id },
        data: { is_cover: false },
      });
    }

    return tx.property_media.update({
      where: { id },
      data: {
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
        ...(input.isCover !== undefined ? { is_cover: input.isCover } : {}),
      },
    });
  });

  sendSuccess(res, updated);
}

export async function updateSpaceMedia(req, res) {
  const { id } = req.params;
  const input = req.body;

  const media = await prisma.space_media.findUnique({
    where: { id },
    include: {
      spaces: {
        include: {
          properties: { select: { owner_id: true } },
        },
      },
    },
  });

  if (!media) {
    throw AppError.notFound('Media item not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsSpace(media.spaces, req.user.id);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isCover === true) {
      await tx.space_media.updateMany({
        where: { space_id: media.space_id },
        data: { is_cover: false },
      });
    }

    return tx.space_media.update({
      where: { id },
      data: {
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
        ...(input.isCover !== undefined ? { is_cover: input.isCover } : {}),
      },
    });
  });

  sendSuccess(res, updated);
}

export async function uploadAvatar(req, res) {
  const userId = req.user.id;
  const file = req.file;
  const detected = req.detectedFile;

  const bucket = 'Avatars'; // exact capital A
  const storagePath = `${userId}/${uuidv4()}.${detected.ext}`;

  // Find previous avatar asset to clean up
  const previousAsset = await prisma.media_assets.findFirst({
    where: {
      owner_type: 'PROFILE',
      owner_id: userId,
      bucket: 'Avatars',
    },
    orderBy: { created_at: 'desc' },
  });

  const publicUrl = await storageService.uploadPublicFile(bucket, storagePath, file.buffer, detected.mimeType);

  try {
    await prisma.$transaction([
      prisma.profiles.update({
        where: { id: userId },
        data: { avatar_url: publicUrl },
      }),
      prisma.media_assets.create({
        data: {
          owner_type: 'PROFILE',
          owner_id: userId,
          bucket,
          storage_path: storagePath,
          mime_type: detected.mimeType,
          size_bytes: file.size,
          uploaded_by: userId,
        },
      }),
    ]);

    // Delete old avatar from storage if existed
    if (previousAsset?.storage_path) {
      await storageService.deleteFile(bucket, previousAsset.storage_path);
    }

    sendSuccess(res, { avatarUrl: publicUrl }, 200);
  } catch (error) {
    await storageService.deleteFile(bucket, storagePath);
    throw error;
  }
}
