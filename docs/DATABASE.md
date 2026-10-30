# Database setup and schema

SkillBridge uses **MongoDB 6.0+** through the official `mongodb` Node.js driver. Sessions are stored in MongoDB too (`connect-mongo`). There are no SQL migrations: MongoDB creates collections on first write, and `server/db.js` defines the indexes the application relies on.

| Command | What it does |
| --- | --- |
| `npm run db:setup` | Creates all indexes (idempotent). The API server also runs this on startup. |
| `npm run db:seed` | Optional. Inserts illustrative demo courses and opportunities, skipping records that already exist. |

Back up the database before changing indexes or data in a deployed environment. The application never drops collections or data on startup.

## Local database

Run a local `mongod` (or Docker: `docker run -d -p 27017:27017 --name skillbridge-mongo mongo:7`) or create a free MongoDB Atlas cluster, then configure the API environment:

```text
MONGODB_URI=mongodb://127.0.0.1:27017/skillbridge
```

Standalone servers are supported. The code does not use multi-document transactions, so a replica set is not required.

## Collections

Relational tables that were always read together were merged into one document. Everything else keeps its own collection and refers to other documents by `ObjectId`.

| Collection | Contents and key relationships |
| --- | --- |
| `users` | `name`, unique normalized `email`, `password_hash`, server-controlled `role` (`student`/`admin`), `interests[]`, embedded `profile` (`bio`, `location`, `weekly_learning_hours`, `updated_at`), `created_at`. Replaces `users` + `user_profiles`. |
| `courses` | Catalog fields, `is_demo`, and embedded `modules[]`, each with embedded `lessons[]` (every module and lesson has its own `_id` and a `position`). Replaces `courses` + `course_modules` + `lessons`. |
| `enrollments` | One document per `user_id` + `course_id` with `progress`, `completed_lesson_ids[]`, `enrolled_at`, `updated_at`. Replaces `enrollments` + `lesson_progress`. |
| `saved_courses` | One document per `user_id` + `course_id` bookmark. |
| `opportunities` | Opportunity catalog records with `is_demo`. |
| `saved_opportunities` | One document per `user_id` + `opportunity_id` bookmark. |
| `applications` | Private tracking record per `user_id` + `opportunity_id`: `status`, `notes`, `applied_at`. It does not submit an application. |
| `career_assessments` | The learner's inputs, `summary`, `source` (`ai`/`demo`), and `plan_details` (the validated plan: directions, roadmap outline, projects, and so on). Replaces `career_assessments` + `career_recommendations`; directions are returned in array order with a computed `position`. |
| `learning_roadmaps` | User-owned roadmap linked to an assessment (`assessment_id`) with embedded `milestones[]` (`_id`, `title`, `description`, `position`, `completed_at`). Replaces `learning_roadmaps` + `roadmap_milestones`. |
| `interview_practice_sessions` | User-owned interview question notes. |
| `user_feedback` | `category`, `message`, optional `user_id`/`email`. |
| `sessions` | Server-side session storage managed by `connect-mongo` (expires after seven days). |

All `_id`, `user_id`, `course_id`, and similar reference fields are `ObjectId` values. The API always sends and accepts them as 24-character hexadecimal strings.

## Indexes

| Collection | Index | Purpose |
| --- | --- | --- |
| `users` | `{ email: 1 }` **unique** | Prevents duplicate accounts, including concurrent registrations. |
| `enrollments` | `{ user_id: 1, course_id: 1 }` **unique** | One enrollment per user and course. |
| `saved_courses` | `{ user_id: 1, course_id: 1 }` **unique** | Idempotent bookmarks. |
| `saved_opportunities` | `{ user_id: 1, opportunity_id: 1 }` **unique** | Idempotent bookmarks. |
| `applications` | `{ user_id: 1, opportunity_id: 1 }` **unique**, `{ user_id: 1, updated_at: -1 }` | One tracker record per opportunity; recent-first listing. |
| `learning_roadmaps` | `{ user_id: 1, assessment_id: 1 }` **unique**, `{ user_id: 1, updated_at: -1 }` | One roadmap per assessment; recent-first listing. |
| `career_assessments` | `{ user_id: 1, created_at: -1 }` | Latest assessment lookup. |
| `interview_practice_sessions` | `{ user_id: 1, updated_at: -1 }` | Recent-first listing. |
| `courses`, `opportunities`, `user_feedback` | `created_at` descending (plus `title` on courses) | Catalog and admin ordering. |

## What replaces SQL features

- **Constraints and `CHECK`s:** the unique indexes above replace `UNIQUE`/primary keys. Field validation (lengths, enums, ranges) is enforced by the Zod schemas in `server/app.js` before anything is written; the database itself does not carry `$jsonSchema` validators.
- **Cascading deletes:** MongoDB has no foreign keys. The MVP never deletes users, courses, or opportunities, so nothing is orphaned. Unenrolling deletes the enrollment document, which also resets that course's lesson progress. If you add delete endpoints later, remove the dependent documents in the same handler.
- **Transactions:** lesson progress uses a single atomic update; creating a course is a single insert; career assessments write an assessment then a roadmap and delete the assessment again if the roadmap insert fails.
- **Admin promotion:** use a trusted database operation, never an API call:

  ```js
  // mongosh
  db.users.updateOne({ email: 'admin@example.com' }, { $set: { role: 'admin' } })
  ```

## Database validation status

Automated API tests use an in-memory stand-in for the MongoDB driver (`tests/helpers/fake-mongo.js`) to exercise HTTP, authorization, and data-shape behavior without a server. That stand-in is not MongoDB. Run the app against a real local or Atlas database to verify index creation, the aggregation-pipeline update used for lesson progress, session storage, and live driver behavior.
