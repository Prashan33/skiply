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

export const CATALOG_COURSES_QUERY = defineQuery(`
  *[_type == "course" && defined(slug.current)] | order(popular desc, title asc) {
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
    "lessonCount": count(modules[].lessons[])
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
    "poster": poster{ ${IMAGE_FRAGMENT} },
    notes[]{
      ...,
      _type == "image" => { ${IMAGE_FRAGMENT} }
    },
    resources[]{ _key, type, title, description, url },
    "course": *[_type == "course" && references(^._id)][0]{
      _id,
      title,
      "slug": slug.current,
      instructor->{ name, "slug": slug.current },
      "modules": modules[]{
        _key,
        title,
        "lessonIds": lessons[]._ref
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
