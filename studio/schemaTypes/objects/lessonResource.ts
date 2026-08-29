import {LinkIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

/**
 * A downloadable / linked resource attached to a lesson.
 */
export const lessonResource = defineType({
  name: 'lessonResource',
  title: 'Resource',
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'type',
      type: 'string',
      options: {
        list: [
          {title: 'Link', value: 'link'},
          {title: 'Download', value: 'download'},
          {title: 'Documentation', value: 'documentation'},
          {title: 'Code', value: 'code'},
        ],
        layout: 'radio',
      },
      initialValue: 'link',
      validation: (rule) => rule.required(),
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
    defineField({
      name: 'url',
      type: 'url',
      validation: (rule) =>
        rule.required().uri({scheme: ['http', 'https']}),
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'type'},
  },
})
