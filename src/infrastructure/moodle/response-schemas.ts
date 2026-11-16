import { z } from 'zod';
import { MoodleError } from '../../domain/errors.js';

export const idSchema = z.number().int().positive();
const timestamp = z.number().finite().nonnegative().nullish();
const visible = z.union([z.boolean(), z.literal(0), z.literal(1)]).nullish();
export const siteSchema = z.object({
  release: z.string(), version: z.string(), sitename: z.string(), lang: z.string(),
});
export const identitySchema = z.object({userid: idSchema, fullname: z.string(), username: z.string().nullish()});
export const emailSchema = z.array(z.object({id: idSchema, email: z.string().nullish()}));
export const coursesSchema = z.array(z.object({
  id: idSchema, shortname: z.string(), fullname: z.string(), summary: z.string().nullish(),
  category: z.number().int().nonnegative().nullish(), startdate: timestamp, enddate: timestamp,
  visible, progress: z.number().finite().nullish(), lastaccess: timestamp,
}));
export const sectionsSchema = z.array(z.object({
  id: idSchema, section: z.number().int().nonnegative().nullish(), name: z.string(),
  summary: z.string().nullish(), visible,
  modules: z.array(z.object({
    id: idSchema, name: z.string(), modname: z.string(), url: z.string().nullish(), visible,
    availabilityinfo: z.string().nullish(), availability: z.string().nullish(),
    contents: z.array(z.unknown()).optional(),
  })),
}));
export const contentSchema = z.object({type: z.string()});
export const fileSchema = z.object({
  filename: z.string(), filesize: z.number().finite().nonnegative().nullish(),
  mimetype: z.string().nullish(), timemodified: timestamp,
});
export function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new MoodleError('OPERATION_FAILED');
  return parsed.data;
}
