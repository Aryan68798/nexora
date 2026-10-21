import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';

export async function getCategories(_req, res) {
  const categories = await prisma.service_categories.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });

  sendSuccess(res, categories);
}

export async function createCategory(req, res) {
  const input = req.body;

  const category = await prisma.service_categories.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      is_active: input.isActive ?? true,
    },
  });

  sendSuccess(res, category, 201);
}

export async function updateCategory(req, res) {
  const { id } = req.params;
  const input = req.body;

  const dataToUpdate = {};

  if (input.name !== undefined) dataToUpdate.name = input.name;
  if (input.description !== undefined) dataToUpdate.description = input.description;
  if (input.isActive !== undefined) dataToUpdate.is_active = input.isActive;

  const updated = await prisma.service_categories.update({
    where: { id },
    data: dataToUpdate,
  });

  sendSuccess(res, updated);
}
