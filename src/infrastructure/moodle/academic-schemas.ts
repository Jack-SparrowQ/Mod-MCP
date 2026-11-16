import { z } from 'zod';
import { idSchema } from './response-schemas.js';

const time = z.number().finite().nonnegative().nullish();
const text = z.string().nullish();
const flag = z.union([z.boolean(), z.literal(0), z.literal(1)]).nullish();
export const assignmentsSchema = z.object({courses: z.array(z.object({
  id: idSchema, assignments: z.array(z.object({
    id: idSchema, cmid: idSchema, name: z.string(), intro: text,
    duedate: time, cutoffdate: time, allowsubmissionsfromdate: time,
  })),
}))});
const submission = z.object({status: text, timemodified: time});
const raw = z.union([z.number().finite(), z.string()]).nullish();
export const submissionSchema = z.object({
  lastattempt: z.object({submission: submission.nullish(), teamsubmission: submission.nullish(), gradingstatus: text}).nullish(),
  feedback: z.object({gradefordisplay: text, gradeddate: time,
    grade: z.object({grade: raw, timemodified: time}).nullish(),
  }).nullish(),
});
export const actionSchema = z.object({events: z.array(z.object({
  id: idSchema, name: z.string(), timesort: time, modulename: text, url: text,
  courseid: z.number().int().nonnegative().nullish(),
  course: z.object({id: z.number().int().nonnegative()}).nullish(),
  action: z.object({actionable: flag}).nullish(),
}))});
export const calendarSchema = z.object({events: z.array(z.object({
  id: idSchema, name: z.string(), description: text, eventtype: z.string(),
  modulename: text, courseid: z.number().int().nonnegative().nullish(),
  timestart: time, timeduration: time, url: text,
}))});
export const overviewSchema = z.object({grades: z.array(z.object({courseid: idSchema, grade: text, rawgrade: raw}))});
export const gradeItemsSchema = z.object({usergrades: z.array(z.object({
  userid: idSchema, courseid: idSchema.optional(),
  gradeitems: z.array(z.object({
    itemname: z.string().nullable(), itemtype: z.string(), itemmodule: z.string().nullable(),
    gradeformatted: z.string(), graderaw: z.number().finite().nullable(),
    grademin: z.number().finite(), grademax: z.number().finite(),
    percentageformatted: z.string(), feedback: z.string(),
    gradedategraded: z.number().finite().nonnegative().nullable(), gradeishidden: z.boolean(),
  })),
}))});
const forums = z.array(z.object({id: idSchema, course: idSchema, type: z.string()}));
export const forumsSchema = z.union([forums, z.object({forums})]);
export const discussionsSchema = z.object({discussions: z.array(z.object({
  discussion: idSchema, name: z.string(), subject: text, userfullname: text,
  created: time, modified: time, timemodified: time, message: text, pinned: flag,
}))});
