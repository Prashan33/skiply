import {FolderIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * A module groups lessons within a course. It is an embedded object on `course`,
 * not its own document. The "Module N" label shown in the UI is derived from the
 * module's position in the course's `modules` array — it is not stored.
 */
export const module = defineType({
  name: 'module',
  title: 'Module',
  type: 'object',
  icon: FolderIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'summary',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'lessons',
      title: 'Lessons',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'lesson'}],
        }),
      ],
      validation: (rule) => rule.required().min(1).unique(),
    }),
  ],
  preview: {
    select: {title: 'title', lessons: 'lessons'},
    prepare({title, lessons}) {
      const count = Array.isArray(lessons) ? lessons.length : 0
      return {
        title: title || 'Untitled module',
        subtitle: `${count} lesson${count === 1 ? '' : 's'}`,
      }
    },
  },
})
