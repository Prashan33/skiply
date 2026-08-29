import {type SchemaTypeDefinition} from 'sanity'

import {category} from './documents/category'
import {course} from './documents/course'
import {instructor} from './documents/instructor'
import {lesson} from './documents/lesson'
import {learningOutcome} from './objects/learningOutcome'
import {lessonResource} from './objects/lessonResource'
import {module} from './objects/module'

export const schema: {types: SchemaTypeDefinition[]} = {
  types: [
    // Documents
    course,
    lesson,
    instructor,
    category,
    // Objects
    module,
    learningOutcome,
    lessonResource,
  ],
}
