import {PlayIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * A `video` document is an internal lookup built by the offline ingestion pipeline
 * (`studio/scripts/ingest/`), one per unique video URL. It is NOT authored in the
 * Studio and is never shown to a learner as a search result (AGENTS §7/§8/§11):
 *
 *   - `chapters` — the creator's table of contents, or empty when the source has none.
 *   - `chunks`   — the transcript split into many short timestamped pieces. Never a
 *                  single field that a query would return wholesale.
 *
 * Lessons link to a video by matching `video.url` to `lesson.videoUrl`. Every field is
 * read-only here because the pipeline owns them.
 */
export const video = defineType({
  name: 'video',
  title: 'Video',
  type: 'document',
  icon: PlayIcon,
  fields: [
    defineField({
      name: 'id',
      title: 'Video id',
      type: 'string',
      readOnly: true,
      description: 'Provider video id (unmodified). Derived from the video URL.',
    }),
    defineField({
      name: 'url',
      title: 'Video URL',
      type: 'url',
      readOnly: true,
      description: 'Matches the linking lesson’s videoUrl.',
      validation: (rule) => rule.uri({scheme: ['http', 'https']}),
    }),
    defineField({
      name: 'chapters',
      title: 'Chapters (table of contents)',
      type: 'array',
      readOnly: true,
      description: 'Creator chapter markers. Empty when the source video has none.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'chapter',
          fields: [
            defineField({
              name: 'startSeconds',
              type: 'number',
              validation: (rule) => rule.required().min(0).integer(),
            }),
            defineField({
              name: 'label',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {label: 'label', startSeconds: 'startSeconds'},
            prepare({label, startSeconds}) {
              const secs = typeof startSeconds === 'number' ? startSeconds : 0
              const mm = Math.floor(secs / 60)
              const ss = String(secs % 60).padStart(2, '0')
              return {title: label, subtitle: `${mm}:${ss}`}
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'chunks',
      title: 'Transcript chunks',
      type: 'array',
      readOnly: true,
      description:
        'Transcript in short timestamped pieces. The ingestion pipeline manages this.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'chunk',
          fields: [
            defineField({
              name: 'startSeconds',
              type: 'number',
              validation: (rule) => rule.required().min(0).integer(),
            }),
            defineField({
              name: 'text',
              type: 'text',
              rows: 2,
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {text: 'text', startSeconds: 'startSeconds'},
            prepare({text, startSeconds}) {
              const secs = typeof startSeconds === 'number' ? startSeconds : 0
              const mm = Math.floor(secs / 60)
              const ss = String(secs % 60).padStart(2, '0')
              return {title: text, subtitle: `${mm}:${ss}`}
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: {url: 'url', chapters: 'chapters', chunks: 'chunks'},
    prepare({url, chapters, chunks}) {
      const chapterCount = Array.isArray(chapters) ? chapters.length : 0
      const chunkCount = Array.isArray(chunks) ? chunks.length : 0
      return {
        title: url || 'Video',
        subtitle: `${chapterCount} chapters · ${chunkCount} chunks`,
      }
    },
  },
})
