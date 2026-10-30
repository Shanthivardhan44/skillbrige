# SkillBridge REST API

The Express API returns JSON unless a successful mutation is documented as `204 No Content`. JSON request bodies are limited to 20 KB. Request bodies are validated with Zod and used only as typed values in MongoDB queries (never as query operators). Validation errors return `400`; unauthenticated account requests return `401`; non-admin requests return `403`; missing records return `404`; duplicate email returns `409`; rate limiting returns `429`; unexpected failures return a generic `500` message and are logged server-side.

All record identifiers (`id`, `course_id`, `lessonId`, and so on) are MongoDB `ObjectId` values rendered as 24-character hexadecimal strings. A malformed identifier returns `400`.

The browser uses an HTTP-only session cookie named `skillbridge.sid`. Include credentials in cross-origin requests. In production, the API only allows configured `FRONTEND_ORIGINS` and requires an allow-listed `Origin` on state-changing requests.

## Health

| Method and path | Access | Description |
| --- | --- | --- |
| `GET /api/health` | Public | Pings MongoDB and returns `{"status":"ok"}`. |

## Authentication and profile

| Method and path | Access | Description |
| --- | --- | --- |
| `POST /api/auth/register` | Public, rate-limited | Creates a student account and session. Accepts `{ "name", "email", "password" }`. Password length: 10–128. Returns `201` with a public user. |
| `POST /api/auth/login` | Public, rate-limited | Accepts `{ "email", "password" }`. Returns a public user and establishes a session; invalid credentials receive a generic `401`. |
| `POST /api/auth/logout` | Public | Destroys the current session and clears its cookie; returns `204`. |
| `GET /api/auth/me` | Signed in | Returns the public user, interests, and profile fields. Expired/deleted accounts receive `401`. |
| `GET /api/profile` | Signed in | Returns the current account profile. |
| `PATCH /api/profile` | Signed in | Replaces the editable profile fields: `name`, `interests` (up to 8 labels), `bio`, `location`, and nullable `weekly_learning_hours` (1–40). |

Public registration always assigns the `student` role. Promotion to administrator is an explicit trusted database operation; client-supplied roles are not used.

## Course catalog and learning

| Method and path | Access | Description |
| --- | --- | --- |
| `GET /api/courses` | Public | Lists courses and ordered lesson summaries, including `is_demo`. |
| `GET /api/courses/:courseId` | Public | Returns a course and its modules/lessons. |
| `POST /api/courses/:courseId/enrollments` | Signed in | Creates or returns the current user's enrollment. |
| `DELETE /api/courses/:courseId/enrollments` | Signed in | Removes the user's enrollment; returns `204`. |
| `POST /api/courses/:courseId/progress` | Signed in | Accepts `{ "lessonId": "123" }`; requires enrollment and a lesson belonging to the course. Lesson IDs are 24-character hexadecimal strings. Completion and percentage progress are updated in one atomic database operation. |
| `GET /api/me/saved-courses` | Signed in | Returns `{ "courses": ["<id>"] }`. |
| `PUT /api/me/saved-courses/:id` | Signed in | Saves a course; idempotent and returns `204`. |
| `DELETE /api/me/saved-courses/:id` | Signed in | Removes a saved course; returns `204`. |

## Opportunities and applications

| Method and path | Access | Description |
| --- | --- | --- |
| `GET /api/opportunities` | Public | Lists opportunities with their `is_demo` marker and application URL. Verify all opportunity details independently before applying. |
| `GET /api/opportunities/:opportunityId` | Public | Returns one opportunity. |
| `GET /api/me/saved-opportunities` | Signed in | Returns `{ "opportunities": ["<id>"] }`. |
| `PUT /api/me/saved-opportunities/:id` | Signed in | Saves an opportunity; idempotent and returns `204`. |
| `DELETE /api/me/saved-opportunities/:id` | Signed in | Removes a saved opportunity; returns `204`. |
| `GET /api/me/applications` | Signed in | Lists the user's application-tracking records. Tracking does not submit an application. |
| `PUT /api/me/applications/:opportunityId` | Signed in | Upserts `{ "status", "notes" }`. Status is `interested`, `preparing`, `applied`, `interviewing`, `rejected`, `accepted`, or `withdrawn`. |
| `DELETE /api/me/applications/:opportunityId` | Signed in | Deletes the tracking record; returns `204`. |

## Career assessment and roadmap

### Persisting a completed assessment

`POST /api/career-assessments` requires a signed-in user and accepts:

```json
{
  "interests": ["Data, patterns, and problem-solving"],
  "skill_level": "beginner",
  "work_style": "analytical",
  "technical_skills": ["Spreadsheets"],
  "career_goals": ["Prepare for internships"],
  "weekly_availability": 4,
  "mode": "demo",
  "recommendations": {
    "summary": "A useful starting direction.",
    "directions": [
      {
        "title": "Data analyst",
        "whyFit": "You enjoy investigating questions.",
        "foundationalSkills": ["Spreadsheets", "SQL"]
      }
    ],
    "roadmap": [
      { "stage": "Build foundations", "focus": "Practice a small data question.", "activities": ["Explore a sample dataset"] }
    ],
    "projects": ["Summarize a public dataset"],
    "portfolioImprovements": ["Explain your process"],
    "interviewTasks": ["Practice a project story"],
    "nextAction": "Choose one dataset to explore."
  }
}
```

The `mode` is `ai` or `demo`; recommendation content is validated against the server-side response schema. The assessment (with its recommendations) and the roadmap (with its milestones) are stored as two documents; if the roadmap cannot be saved, the assessment is removed again.

| Method and path | Access | Description |
| --- | --- | --- |
| `POST /api/career-assessments` | Signed in | Stores assessment and generated plan; returns `201`. |
| `GET /api/career-assessments/latest` | Signed in | Returns the latest assessment, recommendations, roadmap milestones, and disclaimer. Returns `404` when none exists. |
| `GET /api/roadmaps` | Signed in | Lists the current user's roadmaps and milestone states. |
| `PATCH /api/roadmaps/:roadmapId/milestones/:milestoneId` | Signed in | Accepts `{ "completed": true }`; only the owning user's milestones can be changed. |

Career recommendations are educational guidance, not a guarantee of employment or a scientifically validated assessment.

## Interview practice and feedback

| Method and path | Access | Description |
| --- | --- | --- |
| `GET /api/me/interview-practice` | Signed in | Lists up to 50 saved practice sessions. |
| `POST /api/me/interview-practice` | Signed in | Accepts `{ "question", "answer_notes" }`; returns `201`. |
| `PATCH /api/me/interview-practice/:sessionId` | Signed in | Updates the user's own session. |
| `POST /api/feedback` | Public, rate-limited | Accepts `{ "category", "message", "email?" }`. Anonymous feedback must include a valid email address; signed-in feedback may omit it. Returns `201` after database confirmation. |

## AI guidance

`POST /api/guidance` is public and rate-limited to 10 requests/minute/IP by default. Request size is limited to 8 KB and provider calls time out after 20 seconds. Validation errors return `400`, rate-limit responses `429`, and unavailable, timed-out, or invalid provider responses return an error rather than a success-shaped demo response.

Chat requests accept `mode: "chat"` (default), a 3–1200 character `message`, optional bounded `history`, up to 8 `interests`, and `experience` (`beginner`, `some-experience`, or `experienced`). Assessment requests use `mode: "assessment"` with interests, work style, career goals, skills, and optional weekly availability. Successful responses include `mode: "ai" | "demo"`; demo responses are deterministic and explicitly not AI-generated. Chat messages are not stored by SkillBridge. The configured provider may have separate retention terms.

Set all of `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` on the server for a compatible OpenAI-style provider. Leave all three blank to use demo responses. Partial configuration is an error. Provider URLs must use HTTPS except localhost development URLs. API credentials are never sent to or embedded in the frontend.

## Administrator

These endpoints read the user's role from MongoDB on the server. New users cannot set their own role.

| Method and path | Access | Description |
| --- | --- | --- |
| `GET /api/admin/summary` | Administrator | Returns counts for users, courses, opportunities, and feedback. |
| `POST /api/admin/courses` | Administrator | Creates a course and a starter module with three lesson records. |
| `POST /api/admin/opportunities` | Administrator | Creates an opportunity. The UI continues to label opportunity records as unverified. |

The MVP does not provide user management or catalog edit/delete endpoints.

## Error and security behavior

Validation responses include a safe user-facing `error` and, when available, field-level `details`. Internal database/stack details are not returned. Sessions use HTTP-only cookies, passwords are hashed with bcrypt, login/registration and feedback are rate-limited, and state-changing cross-origin requests require a configured origin. Use HTTPS in production and configure the MongoDB host's TLS requirements.
