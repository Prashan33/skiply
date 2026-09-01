import {UserIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Per-learner progress, keyed by the Clerk user id (AGENTS.md §7/§8). This is
 * *app state*, kept apart from the read-only content graph: it is written ONLY by
 * the `POST /api/progress` server route (with a write token), never authored in
 * the Studio, and it stores `lessonId` as a plain string rather than a reference
 * so it does not entangle with content publishing.
 *
 * One document per learner, `_id = "progress." + userId`. It is outside the
 * search Context `groqFilter` (`_type in ["course","lesson"]`), so it never
 * reaches the search agent.
 */
export const progress = defineType({
  name: 'progress',
  title: 'Learner progress',
  type: 'document',
  icon: UserIcon,
  readOnly: true,
  // Keep it out of the Studio's global search — it is machine-written state.
  __experimental_omnisearch_visibility: false,
  fields: [
    defineField({
      name: 'userId',
      title: 'Clerk user id',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'entries',
      title: 'Lesson entries',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'entry',
          fields: [
            defineField({
              name: 'lessonId',
              title: 'Lesson document id',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'secondsWatched',
              title: 'Cumulative unique seconds watched',
              type: 'number',
              validation: (rule) => rule.required().min(0).integer(),
            }),
            defineField({
              name: 'completed',
              type: 'boolean',
              initialValue: false,
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'completedAt',
              type: 'datetime',
            }),
            defineField({
              name: 'lastPosition',
              title: 'Resume position (seconds)',
              type: 'number',
              validation: (rule) => rule.required().min(0).integer(),
            }),
            defineField({
              name: 'updatedAt',
              type: 'datetime',
            }),
          ],
          preview: {
            select: {lessonId: 'lessonId', completed: 'completed', secondsWatched: 'secondsWatched'},
            prepare({lessonId, completed, secondsWatched}) {
              const secs = typeof secondsWatched === 'number' ? secondsWatched : 0
              return {
                title: lessonId || 'entry',
                subtitle: `${completed ? '✓ complete' : 'in progress'} · ${secs}s watched`,
              }
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'bookmarks',
      title: 'Bookmarks',
      description:
        'Learner-saved lessons and courses, written only by POST /api/bookmarks. ' +
        'Drives the My Learning page. `refId` is a plain document id string, not a reference.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'bookmark',
          fields: [
            defineField({
              name: 'kind',
              type: 'string',
              options: {list: ['lesson', 'course']},
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'refId',
              title: 'Lesson or course document id',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'bookmarkedAt',
              type: 'datetime',
            }),
          ],
          preview: {
            select: {kind: 'kind', refId: 'refId'},
            prepare({kind, refId}) {
              return {title: refId || 'bookmark', subtitle: kind || 'bookmark'}
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: {userId: 'userId', entries: 'entries'},
    prepare({userId, entries}) {
      const list = Array.isArray(entries) ? entries : []
      const done = list.filter((e) => e && e.completed).length
      return {
        title: userId || 'progress',
        subtitle: `${done}/${list.length} lessons complete`,
      }
    },
  },
})
