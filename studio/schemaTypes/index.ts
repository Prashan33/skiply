import {type SchemaTypeDefinition} from 'sanity'

import {category} from './documents/category'
import {course} from './documents/course'
import {instructor} from './documents/instructor'
import {lesson} from './documents/lesson'
import {progress} from './documents/progress'
import {video} from './documents/video'
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
    video,
    progress,
    // Objects
    module,
    learningOutcome,
    lessonResource,
  ],
}
