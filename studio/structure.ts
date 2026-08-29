import {BookIcon, PlayIcon, TagIcon, UsersIcon} from '@sanity/icons'
import type {StructureResolver} from 'sanity/structure'

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.documentTypeListItem('course').title('Courses').icon(BookIcon),
      S.documentTypeListItem('lesson').title('Lessons').icon(PlayIcon),
      S.documentTypeListItem('instructor').title('Instructors').icon(UsersIcon),
      S.documentTypeListItem('category').title('Categories').icon(TagIcon),
    ])
