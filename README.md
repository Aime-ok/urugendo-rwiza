# Gira Provisoir

Build a complete responsive web application based on the attached reference screenshot.

IMPORTANT:

- Keep the same overall visual style, layout, colors, cards, spacing and professional appearance as the reference.

- The entire user interface must be in Kinyarwanda.

- The application is an educational driving-test practice platform.

- At the bottom of every page, display:

  "Powered by iNEX Technology Service Ltd"

MAIN PAGE:

Create a dashboard similar to the reference image with:

1. Logo/header area

   - Use the same general placement and style as the reference.

   - Main title: "Ahabanza"

   - Add a welcome message for the logged-in learner.

   - Keep a Logout button.

2. Two main cards:

   A. "Kwiyigisha"

      Description:

      "Wige ku buryo bwawe ukoreshe ibibazo n'ibisubizo ako kanya"

      Button:

      "Tangira Kwiga"

   B. "Gukora Ikizamini"

      Description:

      "Kora ikizamini gifite igihe kandi ugerageze ubumenyi bwawe"

      Button:

      "Tangira Ikizamini"

BOOK / STUDY MATERIAL FEATURE:

Create an administrator/teacher section where I can upload an educational book/document.

The uploaded book should become the main learning source for the application.

The system should:

- Accept PDF books/documents.

- Read and extract useful educational content from the uploaded book.

- Generate questions and answers based ONLY on the uploaded book.

- Store the uploaded book and generated questions in the database.

- Allow the administrator to replace/update the book later.

- Avoid generating questions from information that is not contained in the uploaded material.

QUESTION SYSTEM:

The application must generate exactly 20 questions for each test.

Each question should have multiple-choice answers, for example:

A. ...

B. ...

C. ...

D. ...

The questions must be written in clear Kinyarwanda.

Question generation should be intelligent:

- Questions should be based on different parts of the uploaded book.

- Avoid asking the exact same question repeatedly during the same test.

- Mix easy, medium and difficult questions.

- Randomize the order of questions and answer choices when appropriate.

QUESTION HISTORY / MEMORY:

The application must remember questions that have already been given to a learner.

Important behavior:

- If a learner starts learning for the first time, give them questions from the uploaded book.

- Save the questions they have already received and their answers/results.

- When they come back, the system should remember their previous learning progress.

- The learner should be able to review questions they previously received.

- The learner should also be able to continue learning with new questions so that they gradually cover the whole book.

- Do not repeatedly give exactly the same 20 questions every time unless the learner chooses "Subiramo ibibazo nigeze gukora".

Create these learning options:

1. "Ibibazo bishya"

2. "Subiramo ibibazo nigeze gukora"

3. "Komeza kwiga"

LEARNING MODE:

When the learner selects "Kwiyigisha":

- Show one question at a time.

- Show 4 answer choices.

- After the learner selects an answer, immediately show whether it is correct or incorrect.

- Show the correct answer and a short explanation based on the uploaded book.

- Then allow the learner to continue to the next question.

- Save their progress.

EXAM MODE:

When the learner selects "Gukora Ikizamini":

- Generate exactly 20 questions.

- Show one question at a time.

- Add a visible progress indicator such as:

  "Ikibazo 5 / 20"

- Include a countdown timer.

- The learner must answer all 20 questions.

- At the end, calculate the score.

PASSING SCORE:

The passing mark must be 12/20.

Rules:

- 12/20 or higher = "Watsinze"

- 11/20 or lower = "Ntabwo watsinze"

Display the result clearly:

"AMANOTA YAWE: 15/20"

"WATSINZE"

or

"AMANOTA YAWE: 10/20"

"NTABWO WATSINZE"

Also display:

- Number correct

- Number incorrect

- Percentage

- Passing mark: 12/20

RESULT HISTORY:

Save every completed test in the database.

For each learner store:

- Date

- Score

- Number correct

- Number incorrect

- Percentage

- Questions attempted

Create a "Amateka y'ibizamini" section where the learner can see previous results.

LEARNER PROGRESS:

Create a progress section showing:

- Ibibazo amaze gukora

- Ibibazo yasubije neza

- Ibibazo yasubije nabi

- Ibizamini yakoze

- Amanota meza

- Progress percentage

REVIEW:

After completing an exam, allow:

"Reba ibisubizo"

The learner should be able to see:

- The question

- Their selected answer

- Correct answer

- Explanation

- Whether they were correct or incorrect

DATABASE:

Use a proper database such as Supabase.

Create tables for:

- users

- uploaded_books

- questions

- question_answers

- learner_progress

- exam_attempts

- exam_questions

- learner_answers

Make sure learner data is associated with the correct account.

ADMIN DASHBOARD:

Create an administrator dashboard where the administrator can:

- Upload a new PDF book.

- See the currently active book.

- Delete/replace the active book.

- Generate questions from the book.

- View generated questions.

- Edit questions and answers.

- Delete incorrect questions.

- Add questions manually.

- See learners' exam results.

- See overall learner performance.

QUESTION GENERATION:

Do not hard-code questions.

The system must dynamically generate/store questions from the uploaded book.

If AI integration is needed for question generation, structure the application so an AI API can be connected securely through backend/server-side functions.

Never expose API keys in frontend code.

DESIGN:

Use the reference screenshot as the visual inspiration.

Use:

- Dark blue background similar to the screenshot.

- White rounded cards.

- Yellow/orange button for "Kwiyigisha".

- Blue button for "Gukora Ikizamini".

- Clean modern typography.

- Responsive design for desktop, tablet and mobile.

- Professional educational platform appearance.

Do not make the interface complicated.

KINYARWANDA:

All visible user-facing text must be in Kinyarwanda.

Examples:

- Ahabanza

- Kwiyigisha

- Gukora Ikizamini

- Tangira Kwiga

- Tangira Ikizamini

- Ibibazo bishya

- Komeza kwiga

- Subiramo ibibazo

- Amateka y'ibizamini

- Amanota

- Ibisubizo

- Watsinze

- Ntabwo watsinze

- Ikibazo

- Igisubizo nyacyo

- Komeza

- Subira inyuma

FOOTER:

At the bottom of every page, display exactly:

Powered by iNEX Technology Service Ltd

Make the application fully functional, not just a visual mockup.

Implement authentication, database storage, PDF upload, question management, learner progress, exam scoring, result history and admin functionality.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://urugendo-rwiza.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7caa55d5-d1e9-4e25-a646-1170f6a3a2e4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
