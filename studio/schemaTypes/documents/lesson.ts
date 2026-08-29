import {PlayIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * A lesson is a standalone document. It does NOT store its parent course —
 * derive that with a reverse reference (`*[_type == "course" && references(^._id)]`).
 * The "Lesson N.M" label is derived from module/lesson order, not stored.
 */
export const lesson = defineType({
  name: 'lesson',
  title: 'Lesson',
  type: 'document',
  icon: PlayIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'notes', title: 'Notes & resources'},
  ],
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      group: 'content',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'videoUrl',
      title: 'Video URL',
      type: 'url',
      group: 'content',
      description: 'YouTube, Vimeo, or Bunny URL. Playback stays on-site via the provider embed.',
      validation: (rule) => rule.required().uri({scheme: ['http', 'https']}),
    }),
    defineField({
      name: 'poster',
      title: 'Poster / thumbnail',
      type: 'image',
      group: 'content',
      options: {hotspot: true},
      fields: [
        defineField({name: 'alt', type: 'string', title: 'Alternative text'}),
      ],
    }),
    defineField({
      name: 'duration',
      title: 'Duration (seconds)',
      type: 'number',
      group: 'content',
      description: 'Total length in seconds. The UI formats this as mm:ss.',
      validation: (rule) => rule.required().min(0).integer(),
    }),
    defineField({
      name: 'freePreview',
      title: 'Free preview',
      type: 'boolean',
      group: 'content',
      description: 'Presentational label only — does not grant access.',
      initialValue: false,
    }),
    defineField({
      name: 'studentCount',
      title: 'Student count (display)',
      type: 'number',
      group: 'content',
      validation: (rule) => rule.min(0).integer(),
    }),
    defineField({
      name: 'keyPoints',
      title: 'Key points',
      description: 'Shown in the "In this lesson you will" section.',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({type: 'string'})],
    }),
    defineField({
      name: 'notes',
      title: 'Lesson notes',
      type: 'array',
      group: 'notes',
      of: [
        defineArrayMember({type: 'block'}),
        defineArrayMember({type: 'image', options: {hotspot: true}}),
      ],
    }),
    defineField({
      name: 'proTip',
      title: 'Pro tip',
      type: 'text',
      group: 'notes',
      rows: 3,
    }),
    defineField({
      name: 'resources',
      type: 'array',
      group: 'notes',
      of: [defineArrayMember({type: 'lessonResource'})],
    }),
  ],
  preview: {
    select: {title: 'title', duration: 'duration', media: 'poster'},
    prepare({title, duration, media}) {
      const secs = typeof duration === 'number' ? duration : 0
      const mm = Math.floor(secs / 60)
      const ss = String(secs % 60).padStart(2, '0')
      return {title, subtitle: `${mm}:${ss}`, media}
    },
  },
})
