import {BulbOutlineIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

/**
 * A single item in a course's "What you'll learn" section.
 * Embedded object — only meaningful inside its parent course.
 */
export const learningOutcome = defineType({
  name: 'learningOutcome',
  title: 'Learning outcome',
  type: 'object',
  icon: BulbOutlineIcon,
  fields: [
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'lucide-react icon name shown next to the outcome (e.g. "target").',
    }),
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 2,
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'description'},
  },
})
