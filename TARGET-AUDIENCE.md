# CUE AI — Target Audience

This document defines who the bot should connect with, message, and engage. These definitions live in `.env` and are injected into every Claude prompt automatically.

---

## Primary — The People Who Actually Buy

**Software engineers and developers actively interviewing.**

Specifically: people targeting product companies, startups, or FAANG-equivalent roles in India who are in an active job search cycle or planning a role switch in the next 1–3 months.

| Attribute | Detail |
|-----------|--------|
| Age | 21–30 |
| Experience | 0–3 years |
| Education | Tier 1 and tier 2 engineering college graduates |
| Location | India |
| Signal | "Open to Work" badge, mentions of job hunting, recent grad |
| Pain point | Know AI tools exist but haven't found one that works *during the actual interview moment* |

**Score 9–10** if: "Open to Work" on profile, headline mentions "seeking" or "looking for role", fresh CS/IT grad, or explicitly job hunting in their About section.

**Score 7–8** if: junior/mid engineer with 1–3 years experience who is likely in or near a job-search cycle.

---

## Secondary — The People Who Share and Recommend

**Students and bootcamp graduates actively job hunting.**

| Group | Detail |
|-------|--------|
| College students | Final year CS/IT at NITs, IIITs, tier 2 engineering colleges going through campus placements |
| Bootcamp graduates | Masai School, Newton School, Scaler, GUVI — actively hunting after completing their program |
| Price sensitivity | ₹200/hr resonates because they can't afford $50/month tools |

These users are secondary buyers but primary sharers. One student telling their batch of 200 about CUE AI is more valuable than a paid ad.

**Score 7–8** for these profiles. Connect and treat them as first-class users.

---

## Tertiary — The Amplifiers

**Career coaches and placement officers.**

They don't buy CUE themselves but they recommend it to hundreds of students. One placement officer at a college endorsing CUE is worth more than a month of LinkedIn posts.

| Signal | Example headlines |
|--------|-------------------|
| Placement officer | "Placement Officer at NIT Trichy", "TPO at [college]" |
| Career coach | "Career Coach for Engineers", "Interview Prep Coach" |
| Trainer | "Trainer at Masai School", "Mentor at Newton School" |

**Score 6** for these profiles. Connect with a different angle — position CUE as a tool they can recommend to their students, not something they buy for themselves.

---

## Who Is NOT the Audience

Do not connect with or prioritize:

| Who | Why |
|-----|-----|
| Engineers with 5+ years, passively open to opportunities | Not in active job-search pain, unlikely to pay ₹200/hr for interview prep |
| HR professionals and recruiters | They're on the other side of the table |
| Non-tech job seekers | CUE is built around technical and behavioral interview formats specific to engineering roles |
| Engineering managers and directors | Beyond the target experience range, different interview format |

**Score 1–2** for these. Do not send connection requests.

---

## The Core User — One Clear Picture

> A 23-year-old software engineer with 1–2 years of experience who has failed 2–3 interview rounds at companies they were qualified for. They know it wasn't a knowledge problem — it was pressure and articulation. They are willing to pay ₹200 to make sure it doesn't happen again in their next session.

Every message, comment, and connection note should feel like it was written *for this person* — even when it's going to someone slightly different. This is the mental model Claude uses when generating content.

---

## LinkedIn Search Keywords

These are set in `TARGET_KEYWORDS` in `.env` and drive the `connect` task:

```
software engineer job search
developer interview preparation
open to work software engineer
SDE job hunting India
fresher software engineer
campus placement engineer
coding bootcamp graduate
junior developer job switch
software engineer 1-2 years experience
actively interviewing developer
```

Tune these over time based on which keywords produce the highest-scoring profiles in `data/connections-sent.json`.

---

## How This Is Used

All five audience variables (`ICP_PRIMARY`, `ICP_SECONDARY`, `ICP_TERTIARY`, `ICP_EXCLUDE`, `ICP_CORE_USER`) are read from `.env` and injected into the `productCtx()` block in `src/claude-service.js`. This means every prompt Claude receives — whether it's scoring a profile, writing a connection note, generating a first message, or drafting a reply — has the full audience picture as context.

To update the audience definition, edit `.env`. No code changes needed.
