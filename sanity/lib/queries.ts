import { defineQuery } from 'next-sanity'

/**
 * Server-side GROQ for the read-only content surfaces (catalog, course, lesson,
 * instructor, category). Types are generated into `/sanity.types.ts` by the
 * Studio's TypeGen (`npm run typegen`).
 *
 * Notes:
 * - "Module N" / "Lesson N.M" labels are NOT stored. Queries return modules and
 *   their lesson `_ref`s in authored order; the ordinal is derived on the client.
 * - A lesson has no parent-course field; the owning course is resolved with a
 *   reverse reference (`*[_type == "course" && references(^._id)]`).
 * - `notes` stays an array for `@portabletext/react`. Plain-text projection
 *   (`pt::text(notes)`) is a later concern for search.
 */

const IMAGE_FRAGMENT = /* groq */ `
  asset,
  hotspot,
  crop,
  "alt": coalesce(alt, "")
`

/* ------------------------------------------------------------------ catalog */

/**
 * Shared catalog-card projection. Reused verbatim by the `/courses` catalog and
 * by the bookmark-driven My Learning list so both feed `<CourseGrid>` with the
 * same shape (and TypeGen produces compatible types).
 */
const CATALOG_COURSE_FIELDS = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  summary,
  level,
  price,
  popular,
  studentCount,
  "coverImage": coverImage{ ${IMAGE_FRAGMENT} },
  instructor->{ name, "slug": slug.current },
  category->{ title, "slug": slug.current },
  "moduleCount": count(modules),
  "lessonCount": count(modules[].lessons[]),
  "durationSeconds": math::sum(modules[].lessons[]->duration)
`

export const CATALOG_COURSES_QUERY = defineQuery(`
  *[_type == "course" && defined(slug.current)] | order(popular desc, title asc) {
    ${CATALOG_COURSE_FIELDS}
  }
`)

/**
 * Courses surfaced on My Learning: directly bookmarked (`$courseIds`) or the
 * parent course of any bookmarked lesson (`$lessonIds`). De-duplicated by the
 * query itself since a course matches at most once.
 */
export const BOOKMARKED_COURSES_QUERY = defineQuery(`
  *[_type == "course" && defined(slug.current) && (
    _id in $courseIds ||
    count((modules[].lessons[]._ref)[@ in $lessonIds]) > 0
  )] | order(popular desc, title asc) {
    ${CATALOG_COURSE_FIELDS}
  }
`)

export const COURSE_SLUGS_QUERY = defineQuery(`
  *[_type == "course" && defined(slug.current)]{ "slug": slug.current }
`)

/* ------------------------------------------------------------------- course */

export const COURSE_BY_SLUG_QUERY = defineQuery(`
  *[_type == "course" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    summary,
    level,
    price,
    popular,
    studentCount,
    "coverImage": coverImage{ ${IMAGE_FRAGMENT} },
    learningOutcomes[]{ _key, icon, title, description },
    instructor->{
      _id,
      name,
      "slug": slug.current,
      "photo": photo{ ${IMAGE_FRAGMENT} },
      expertise,
      bio
    },
    category->{ _id, title, "slug": slug.current, description },
    modules[]{
      _key,
      title,
      summary,
      lessons[]->{
        _id,
        title,
        "slug": slug.current,
        duration,
        freePreview,
        studentCount,
        "poster": poster{ ${IMAGE_FRAGMENT} }
      }
    }
  }
`)

/* ------------------------------------------------------------------- search */

/**
 * Compact course -> modules -> lessons index for the search results page. The
 * results API returns only a lesson `slug`; the page joins against this to
 * derive the course, the "Module N" / "Lesson N.M" labels (from authored
 * order), key points, duration, and poster. Nothing on a result card comes from
 * the model.
 */
export const SEARCH_INDEX_QUERY = defineQuery(`
  *[_type == "course" && defined(slug.current)] | order(title asc) {
    "courseTitle": title,
    "courseSlug": slug.current,
    modules[]{
      title,
      "lessons": lessons[]->{
        "lessonSlug": slug.current,
        "lessonTitle": title,
        duration,
        keyPoints,
        "poster": coalesce(poster, thumbnail){ ${IMAGE_FRAGMENT} }
      }
    }
  }
`)

/**
 * Two-stage timestamp resolution input (AGENTS §7): for a set of matched lesson
 * slugs, project only the chapter/transcript rows of the linked `video` document
 * that match the query tokens — chapters (small, a TOC) in full, transcript
 * chunks capped so a whole transcript is never returned (AGENTS §12). The route
 * (`resolveVideoMoments`) scores these and picks a start second, preferring a
 * chapter hit over a transcript hit. `$tokens` is a wildcarded token array
 * (`["*data*", "*fetch*"]`); `$slugs` is the model's own grounded output.
 */
export const VIDEO_MOMENTS_QUERY = defineQuery(`
  *[_type == "lesson" && defined(videoUrl) && slug.current in $slugs]{
    "lessonSlug": slug.current,
    "video": *[_type == "video" && url == ^.videoUrl][0]{
      "chapterHits": chapters[label match $tokens]{ startSeconds, label },
      "chunkHits": chunks[text match $tokens][0...6]{ startSeconds, text }
    }
  }
`)

/* ------------------------------------------------------------------- lesson */

export const LESSON_SLUGS_QUERY = defineQuery(`
  *[_type == "lesson" && defined(slug.current)]{ "slug": slug.current }
`)

export const LESSON_BY_SLUG_QUERY = defineQuery(`
  *[_type == "lesson" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    videoUrl,
    duration,
    freePreview,
    studentCount,
    keyPoints,
    proTip,
    // The seed stores the lesson image as \`thumbnail\`; \`poster\` is the schema
    // field. Coalesce so either authoring path renders.
    "poster": coalesce(poster, thumbnail){ ${IMAGE_FRAGMENT} },
    // First notes paragraph doubles as the one-line description / metadata.
    "summary": pt::text(notes[0]),
    notes[]{
      ...,
      _type == "image" => { ${IMAGE_FRAGMENT} }
    },
    resources[]{ _key, type, title, description, url },
    "course": *[_type == "course" && references(^._id)][0]{
      _id,
      title,
      "slug": slug.current,
      level,
      instructor->{ name, "slug": slug.current },
      modules[]{
        _key,
        title,
        "lessons": lessons[]->{
          _id,
          title,
          "slug": slug.current,
          duration,
          freePreview
        }
      }
    }
  }
`)

/* --------------------------------------------------------------- instructor */

export const INSTRUCTORS_QUERY = defineQuery(`
  *[_type == "instructor" && defined(slug.current)] | order(name asc) {
    _id,
    name,
    "slug": slug.current,
    expertise,
    "photo": photo{ ${IMAGE_FRAGMENT} },
    "courseCount": count(*[_type == "course" && references(^._id)])
  }
`)

export const INSTRUCTOR_SLUGS_QUERY = defineQuery(`
  *[_type == "instructor" && defined(slug.current)]{ "slug": slug.current }
`)

export const INSTRUCTOR_BY_SLUG_QUERY = defineQuery(`
  *[_type == "instructor" && slug.current == $slug][0]{
    _id,
    name,
    "slug": slug.current,
    expertise,
    bio,
    "photo": photo{ ${IMAGE_FRAGMENT} },
    "courses": *[_type == "course" && references(^._id)] | order(title asc) {
      _id,
      title,
      "slug": slug.current,
      summary,
      level,
      "coverImage": coverImage{ ${IMAGE_FRAGMENT} },
      category->{ title, "slug": slug.current }
    }
  }
`)

/* ----------------------------------------------------------------- category */

export const CATEGORIES_QUERY = defineQuery(`
  *[_type == "category" && defined(slug.current)] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    description,
    "courseCount": count(*[_type == "course" && references(^._id)])
  }
`)

export const CATEGORY_SLUGS_QUERY = defineQuery(`
  *[_type == "category" && defined(slug.current)]{ "slug": slug.current }
`)

export const CATEGORY_BY_SLUG_QUERY = defineQuery(`
  *[_type == "category" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    description,
    "courses": *[_type == "course" && references(^._id)] | order(popular desc, title asc) {
      _id,
      title,
      "slug": slug.current,
      summary,
      level,
      price,
      popular,
      "coverImage": coverImage{ ${IMAGE_FRAGMENT} },
      instructor->{ name, "slug": slug.current }
    }
  }
`)

/* ----------------------------------------------------------------- progress */

/**
 * Per-learner progress record (AGENTS.md §7/§8). App state, written only by
 * `POST /api/progress`. `lessonId` is a plain string id, joined against lessons
 * on the page when labels are needed.
 */
export const PROGRESS_BY_USER_QUERY = defineQuery(`
  *[_type == "progress" && userId == $userId][0]{
    entries[]{
      lessonId,
      secondsWatched,
      completed,
      lastPosition
    },
    "bookmarks": bookmarks[]{
      kind,
      refId
    }
  }
`)
