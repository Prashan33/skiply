import {BookIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const course = defineType({
  name: 'course',
  title: 'Course',
  type: 'document',
  icon: BookIcon,
  groups: [
    {name: 'main', title: 'Overview', default: true},
    {name: 'marketing', title: 'Marketing'},
    {name: 'curriculum', title: 'Curriculum'},
  ],
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      group: 'main',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      group: 'main',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'instructor',
      type: 'reference',
      group: 'main',
      to: [{type: 'instructor'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      type: 'reference',
      group: 'main',
      to: [{type: 'category'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'summary',
      type: 'text',
      group: 'marketing',
      rows: 4,
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover image',
      type: 'image',
      group: 'marketing',
      options: {hotspot: true},
      fields: [
        defineField({name: 'alt', type: 'string', title: 'Alternative text'}),
      ],
    }),
    defineField({
      name: 'level',
      type: 'string',
      group: 'marketing',
      options: {
        list: [
          {title: 'Beginner', value: 'beginner'},
          {title: 'Intermediate', value: 'intermediate'},
          {title: 'Advanced', value: 'advanced'},
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'price',
      type: 'number',
      group: 'marketing',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'popular',
      title: 'Popular',
      type: 'boolean',
      group: 'marketing',
      initialValue: false,
    }),
    defineField({
      name: 'studentCount',
      title: 'Student count (display)',
      type: 'number',
      group: 'marketing',
      validation: (rule) => rule.min(0).integer(),
    }),
    defineField({
      name: 'learningOutcomes',
      title: "What you'll learn",
      type: 'array',
      group: 'marketing',
      of: [defineArrayMember({type: 'learningOutcome'})],
    }),
    defineField({
      name: 'modules',
      title: 'Modules',
      type: 'array',
      group: 'curriculum',
      of: [defineArrayMember({type: 'module'})],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'title', instructor: 'instructor.name', media: 'coverImage'},
    prepare({title, instructor, media}) {
      return {title, subtitle: instructor ? `by ${instructor}` : undefined, media}
    },
  },
})
